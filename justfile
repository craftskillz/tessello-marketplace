# Tessello Marketplace: the Maintainer's everyday commands. `just` alone lists them.
#
# Tessello's tools (Listing Verifier, Index Generator) come from craftskillz/tessello at the commit pinned in
# .github/tessello-commit, checked out into .tessello/ as the CI does. `TESSELLO=../tessello just …` uses a working copy
# of Tessello instead, to try a tool before pinning it. `CATALOGUE=demo/repo just ban …` edits the demo catalogue.

set shell := ["bash", "-euo", "pipefail", "-c"]

repo := "craftskillz/tessello-marketplace"
tessello := env("TESSELLO", ".tessello")
catalogue := env("CATALOGUE", ".")
# The Host the "Install in Tessello" links open; the CI reads the repository variable TESSELLO_HOST.
host := env("TESSELLO_HOST", "https://tessello.pages.dev/")
port := env("PORT", "8787")
# The Host served by `just start` in a working copy of Tessello.
local_host := "http://127.0.0.1:8080/"

default:
    @just --list --unsorted

# ---------------------------------------------------------------------------------------------------------------------
# Tools and the site

# Checks out Tessello's tools at the pinned commit into .tessello/, and installs them as the CI does
tools:
    #!/usr/bin/env bash
    set -euo pipefail
    commit=$(tr -d '[:space:]' < .github/tessello-commit)
    if [ ! -d .tessello/.git ]; then git clone --quiet https://github.com/craftskillz/tessello.git .tessello; fi
    if [ "$(git -C .tessello rev-parse HEAD)" != "$commit" ]; then
        git -C .tessello fetch --quiet origin "$commit"
        git -C .tessello -c advice.detachedHead=false checkout --quiet "$commit"
        rm -rf .tessello/node_modules
    fi
    if [ ! -d .tessello/node_modules ]; then (cd .tessello && npm ci --ignore-scripts --no-audit --no-fund --silent); fi
    echo "Tessello's tools are at ${commit:0:7}."

[private]
_tools:
    @if [ "{{ tessello }}" = ".tessello" ]; then just tools; fi

# Checks every listing and namespaces.json without the network: the format only, not GitHub nor the packages
lint: _tools
    #!/usr/bin/env bash
    set -euo pipefail
    node --input-type=module - "{{ catalogue }}" <<'EOF'
    import { readFile, readdir } from "node:fs/promises";
    import { join, resolve } from "node:path";
    import { pathToFileURL } from "node:url";
    const { parseEntry } = await import(pathToFileURL(resolve("{{ tessello }}/packages/marketplace/src/index.ts")).href);
    const root = process.argv[2];
    const folders = async (path) => (await readdir(path, { withFileTypes: true }).catch(() => [])).filter((e) => e.isDirectory()).map((e) => e.name).sort();
    let problems = 0;
    const namespaces = JSON.parse(await readFile(join(root, "namespaces.json"), "utf8").catch(() => "{}"));
    for (const [name, record] of Object.entries(namespaces)) {
      if (!["active", "frozen", "banned"].includes(record.state) || typeof record.id !== "number" || typeof record.account !== "string") {
        console.error(`namespaces.json: @${name} needs "account", a numeric "id" and a "state" of active, frozen or banned.`);
        problems++;
      }
    }
    let listings = 0;
    for (const namespace of await folders(join(root, "modules"))) {
      for (const name of await folders(join(root, "modules", namespace))) {
        const where = `modules/${namespace}/${name}/entry.json`;
        listings++;
        let raw;
        try {
          raw = JSON.parse(await readFile(join(root, where), "utf8"));
        } catch (error) {
          console.error(`${where}: ${error.message}`);
          problems++;
          continue;
        }
        const { issues } = parseEntry(raw);
        if (raw?.id !== `@${namespace}/${name}`) issues.push({ code: "entry/folder", message: `"id" must be "@${namespace}/${name}", the folder.` });
        for (const issue of issues) console.error(`${where}: ${issue.message} [${issue.code}]`);
        problems += issues.length;
      }
    }
    console.log(`${listings} listing${listings === 1 ? "" : "s"}, ${Object.keys(namespaces).length} Namespace${Object.keys(namespaces).length === 1 ? "" : "s"}, ${problems} problem${problems === 1 ? "" : "s"}.`);
    process.exit(problems > 0 ? 1 : 0);
    EOF

# Builds index.json, its assets and the site into site/, as the Build workflow does (downloads the newest packages)
build: _tools
    rm -rf site
    node {{ tessello }}/packages/marketplace/scripts/build-site.ts --repo {{ catalogue }} --out site --host {{ host }}

# Serves site/ at http://127.0.0.1:8787/ with the CORS header the Host needs to read index.json
serve dir="site":
    @echo "index.json: http://127.0.0.1:{{ port }}/index.json"
    @echo "For a local Host, run in its browser console: localStorage.setItem(\"tessello.marketplace\", \"http://127.0.0.1:{{ port }}/index.json\")"
    npx --yes http-server@14.1.1 {{ dir }} -a 127.0.0.1 -p {{ port }} --cors -c-1 -s

# Builds the site, then serves it
preview: build serve

# Downloads the site the last successful Build run made on GitHub into site-ci/, to look at what the CI produced
site-ci:
    #!/usr/bin/env bash
    set -euo pipefail
    run=$(gh run list --repo {{ repo }} --workflow build.yml --status success --limit 1 --json databaseId --jq '.[0].databaseId')
    if [ -z "$run" ]; then echo "No successful Build run yet." >&2; exit 1; fi
    rm -rf site-ci
    gh run download "$run" --repo {{ repo }} --name site --dir site-ci
    echo "Build run $run is in site-ci/: \`just serve site-ci\` serves it."

# ---------------------------------------------------------------------------------------------------------------------
# A demo catalogue: Tessello's example Modules, packaged and served locally, to try the Host's Marketplace screen, its
# updates, Bans and Withdrawals without publishing anything. Edit it with `CATALOGUE=demo/repo just …`.

# Creates demo/ from Tessello's examples, builds it and serves it with its packages (for a Host at 127.0.0.1:8080)
demo: _tools
    #!/usr/bin/env bash
    set -euo pipefail
    rm -rf demo
    mkdir -p demo/repo/modules demo/packages
    echo '{ "craftskillz": { "account": "craftskillz", "id": 1, "state": "active" } }' | jq . > demo/repo/namespaces.json
    for dir in {{ tessello }}/examples/*/; do
        id=$(jq -r .id "$dir/manifest.json")
        version=$(jq -r .version "$dir/manifest.json")
        path=${id#@}
        mkdir -p "demo/packages/$path" "demo/repo/modules/$path"
        package="$PWD/demo/packages/$path/$version.zip"
        (cd "$dir" && zip -qrX "$package" . -x '.*')
        jq -n --arg id "$id" --arg version "$version" --arg url "http://127.0.0.1:{{ port }}/packages/$path/$version.zip" \
            --arg sha256 "$(shasum -a 256 "$package" | cut -d' ' -f1)" \
            '{ id: $id, source: "https://github.com/craftskillz/tessello", license: "MIT", versions: [{ version: $version, url: $url, sha256: $sha256 }] }' \
            > "demo/repo/modules/$path/entry.json"
    done
    just demo-build
    just serve demo/site

# Builds demo/site again from demo/repo, after a change such as `CATALOGUE=demo/repo just ban …`; the server picks it up
demo-build: _tools
    rm -rf demo/site
    node {{ tessello }}/packages/marketplace/scripts/build-site.ts --repo demo/repo --out demo/site --host {{ local_host }} --packages demo/packages
    cp -R demo/packages demo/site/packages

# Adds version <version> of a demo Module: its example's package with that version, which the Host offers as an update
demo-release id version: _tools
    #!/usr/bin/env bash
    set -euo pipefail
    path={{ trim_start_match(id, "@") }}
    example=$(grep -l '"id": *"{{ id }}"' {{ tessello }}/examples/*/manifest.json | head -1)
    if [ -z "$example" ]; then echo "No example of Tessello is {{ id }}." >&2; exit 1; fi
    work=$(mktemp -d)
    cp -R "$(dirname "$example")/." "$work"
    jq --arg version "{{ version }}" '.version = $version' "$example" > "$work/manifest.json"
    package="$PWD/demo/packages/$path/{{ version }}.zip"
    (cd "$work" && zip -qrX "$package" . -x '.*')
    rm -rf "$work"
    entry="demo/repo/modules/$path/entry.json"
    jq --arg version "{{ version }}" --arg url "http://127.0.0.1:{{ port }}/packages/$path/{{ version }}.zip" \
        --arg sha256 "$(shasum -a 256 "$package" | cut -d' ' -f1)" \
        '.versions += [{ version: $version, url: $url, sha256: $sha256 }]' "$entry" > "$entry.tmp" && mv "$entry.tmp" "$entry"
    just demo-build

# ---------------------------------------------------------------------------------------------------------------------
# Pull requests and reports

# Lists the open pull requests
prs:
    gh pr list --repo {{ repo }}

# Runs the CI's check on pull request <number> from here, reading it through the GitHub API: nothing is posted or merged
check-pr number: _tools
    #!/usr/bin/env bash
    set -euo pipefail
    out=$(mktemp -d)
    GITHUB_TOKEN=$(gh auth token) node {{ tessello }}/packages/marketplace/scripts/check-pull-request.ts \
        --repository {{ repo }} --pull-request {{ number }} --out "$out"
    echo
    cat "$out/comment.md"
    rm -rf "$out"

# Approves a new Module: adds the label "approved", and the CI records its Namespace and merges it
[confirm("Approve this pull request? The CI then records the Namespace and merges it.")]
approve number:
    gh pr edit {{ number }} --repo {{ repo }} --add-label approved

# Lists the open reports of Modules
reports:
    gh issue list --repo {{ repo }} --label report

# Lists the last runs of the Check and Build workflows
runs:
    gh run list --repo {{ repo }} --limit 15

# Creates the labels the workflows and the templates use, or brings their colour and description in line
labels:
    gh label create approved --repo {{ repo }} --force --color 0e8a16 --description "The Maintainer's Approval of a new Module"
    gh label create report --repo {{ repo }} --force --color d93f0b --description "A report of a Module"
    gh label create namespace-changed --repo {{ repo }} --force --color fbca04 --description "The GitHub account of a Namespace changed: the Namespace is frozen"

# ---------------------------------------------------------------------------------------------------------------------
# Bans and Namespaces. Each edits the files only: the Maintainer's pull requests are merged by hand (`just pr`).

# Bans a Module, with the reason Hosts show to its Users
ban id reason: (_edit-entry id '.banned = $reason' reason)

# Lifts the Ban of a Module
unban id: (_edit-entry id 'del(.banned)' "")

# Bans one version of a Module, with the reason Hosts show to its Users
ban-version id version reason: (_edit-entry id '(.versions[] | select(.version == $version)).banned = $reason' reason version)

# Lifts the Ban of one version of a Module
unban-version id version: (_edit-entry id '(.versions[] | select(.version == $version)) |= del(.banned)' "" version)

# Takes back a Withdrawal of a Module, which only the Maintainer may do
unwithdraw id: (_edit-entry id 'del(.withdrawn)' "")

[private]
_edit-entry id filter reason version="":
    #!/usr/bin/env bash
    set -euo pipefail
    entry="{{ catalogue }}/modules/{{ trim_start_match(id, "@") }}/entry.json"
    if [ ! -f "$entry" ]; then echo "No listing at $entry." >&2; exit 1; fi
    if [ -n "{{ version }}" ] && ! jq -e --arg version "{{ version }}" 'any(.versions[]; .version == $version)' "$entry" >/dev/null; then
        echo "{{ id }} has no version {{ version }}." >&2; exit 1
    fi
    jq --arg reason {{ quote(reason) }} --arg version "{{ version }}" '{{ filter }}' "$entry" > "$entry.tmp" && mv "$entry.tmp" "$entry"
    jq . "$entry"

# Bans a whole Namespace: every Module of it, and every pull request from it
ban-namespace namespace reason: (_edit-namespace namespace '.[$name].state = "banned" | .[$name].reason = $reason' reason)

# Ends the Ban or the freeze of a Namespace, with the same GitHub account
activate-namespace namespace: (_edit-namespace namespace '.[$name].state = "active" | del(.[$name].reason)' "")

# Freezes a Namespace by hand: its pull requests are refused until the Maintainer decides
freeze-namespace namespace: (_edit-namespace namespace '.[$name].state = "frozen"' "")

# Gives a frozen Namespace to a GitHub account (a renamed one, or its new owner), and makes it active again
rebind-namespace namespace account:
    #!/usr/bin/env bash
    set -euo pipefail
    id=$(gh api "users/{{ account }}" --jq .id)
    just _edit-namespace {{ namespace }} '.[$name] = { account: $account, id: ($id | tonumber), state: "active" }' "" "{{ account }}" "$id"

[private]
_edit-namespace namespace filter reason account="" id="0":
    #!/usr/bin/env bash
    set -euo pipefail
    file="{{ catalogue }}/namespaces.json"
    name={{ quote(trim_start_match(namespace, "@")) }}
    if [ -z "{{ account }}" ] && ! jq -e --arg name "$name" 'has($name)' "$file" >/dev/null; then
        echo "@$name is not in namespaces.json." >&2; exit 1
    fi
    jq --arg name "$name" --arg reason {{ quote(reason) }} --arg account "{{ account }}" --arg id "{{ id }}" \
        '{{ filter }} | to_entries | sort_by(.key) | from_entries' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    jq --arg name "$name" '{ ($name): .[$name] }' "$file"

# Commits what changed on a new branch, pushes it and opens the Maintainer's pull request, to merge by hand
[confirm("Commit every change, push a new branch and open a pull request?")]
pr title:
    #!/usr/bin/env bash
    set -euo pipefail
    if git diff --quiet && git diff --cached --quiet; then echo "Nothing to commit." >&2; exit 1; fi
    branch="maintainer/$(date +%Y%m%d-%H%M%S)"
    git switch --quiet --create "$branch"
    git add --all
    git commit --quiet --message {{ quote(title) }}
    git push --quiet --set-upstream origin "$branch"
    gh pr create --repo {{ repo }} --title {{ quote(title) }} --body "A change of the Maintainer, merged by hand: the check only accepts a single listing from its owner."

# ---------------------------------------------------------------------------------------------------------------------
# Tessello's tools

# Pins Tessello's tools to <commit> (by default the head of craftskillz/tessello's main), for the Maintainer's pull request
pin commit="":
    #!/usr/bin/env bash
    set -euo pipefail
    commit="{{ commit }}"
    if [ -z "$commit" ]; then commit=$(git ls-remote https://github.com/craftskillz/tessello.git refs/heads/main | cut -f1); fi
    if ! [[ "$commit" =~ ^[0-9a-f]{40}$ ]]; then echo "Give the full 40-character commit." >&2; exit 1; fi
    echo "$commit" > .github/tessello-commit
    just tools
    just lint

# Removes what the commands made: site/, site-ci/ and demo/ (and .tessello/ with `just clean all`)
clean what="":
    rm -rf site site-ci demo
    @if [ "{{ what }}" = "all" ]; then rm -rf .tessello; fi
