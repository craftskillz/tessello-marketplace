# Tessello Marketplace

The free catalogue of [Tessello](https://github.com/craftskillz/tessello) Modules. Each Module has a listing in `modules/<namespace>/<name>/`; the CI checks every pull request and, at each merge, builds `index.json` and the Marketplace site.

- **Creators**: read [PUBLISHING.md](PUBLISHING.md) before opening a pull request.
- **Users**: install Modules from the Marketplace screen of your Tessello Host. Report a Module with the **Report a Module** issue template.

## For the Maintainer

- **Approval**: a new Module's pull request waits with the comment "awaits the Maintainer's Approval". Add the label `approved` to approve it: the CI checks it again, records its Namespace in `namespaces.json` if it is new, then merges it. A new commit on the pull request removes the label.
- **Labels**: create the labels `approved` (the Approval) and `report` (used by the issue template) once. Give no one else triage or write access: adding `approved` is the Approval.
- **Other changes**: a pull request that passes the check but is neither a new Module, a new version nor a metadata change gets the comment "this change goes to the Maintainer", and waits.
- **Merge token**: the repository secret `MERGE_TOKEN` is a fine-grained token restricted to this repository, with *Contents* and *Pull requests* read and write. A token is needed instead of the workflow's own so that the merge starts the Build workflow. It is given only to the step that merges.
- **Tools**: the CI runs Tessello's Listing Verifier and Index Generator from `craftskillz/tessello`, at the commit written in `.github/tessello-commit`. Raising it is a pull request of the Maintainer.
- **Deployment**: at each merge, the Build workflow deploys the site to the Cloudflare Pages project `tessello-marketplace`, at `https://tessello-marketplace.pages.dev/`. Every Tessello Host reads `https://tessello-marketplace.pages.dev/index.json`: never rename nor delete the project. The `_headers` file the Index Generator writes lets any origin read `index.json` and the assets. The deployment job needs the repository variable `CLOUDFLARE_ACCOUNT_ID` (without it, the job is skipped and the site stays an artifact of the run) and the secret `CLOUDFLARE_API_TOKEN`, an account token with the single permission *Cloudflare Pages: Edit*. Run Build by hand (*Actions → Build → Run workflow*) to deploy again.
- **Free quotas** (Cloudflare Pages Free plan): 500 builds a month (one deployment per merge), 20,000 files per site, 25 MiB per file, 100 `_headers` rules. Static files are served without a bandwidth limit (ADR 0014 of Tessello).
- **Host address**: the repository variable `TESSELLO_HOST` is the Host the "Install in Tessello" links open (default `https://tessello.pages.dev/`).
- **Pull requests of the Maintainer** (a Ban, a raised commit, a change of these files) are refused by the check, which only accepts a single listing folder from its owner: merge them by hand.
