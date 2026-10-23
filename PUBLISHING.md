# Publishing a Module on the Tessello Marketplace

The Tessello Marketplace is a free catalogue of Modules made by their Creators. It is this public repository: one listing per Module, added by pull request, checked by the CI and turned into the index the Tessello Host reads. There is no account to create and nothing to pay.

Read this page before you open your first pull request. Ticking the box of the pull request template means you have read it and accept it.

## What you accept

- **Approval is not a guarantee.** A new Module enters the Marketplace only with the Maintainer's Approval, given once, at the Maintainer's sole discretion, with no published checklist and no obligation to give a reason. An Approval says nothing about the quality, safety or behaviour of your Module.
- **Later versions are not reviewed.** Once your Module is approved, each new version is merged automatically when the CI passes. Nobody reads its code.
- **A Ban can happen at any time, without notice.** The Maintainer can ban a version, a Module or a whole Namespace at any time, with or without a report, and without notice. Hosts that installed it are warned, with the reason. A Ban is never lifted by a pull request of yours.
- **Your code is provided "as is", under your sole responsibility.** You answer for your Module, for what it does and for what it asks for. Neither the Maintainer nor the Tessello project reviews, audits, certifies or answers for it. Users install it at their own risk.
- **Your source is public, under an OSI-approved licence.** The listing names a public GitHub repository and its licence, as an SPDX identifier approved by the Open Source Initiative (for example `MIT`, `Apache-2.0`, `GPL-3.0-only`). GitHub must report that same licence for the repository.

## Your Namespace

You publish under the Namespace of your GitHub account: the account `jane` publishes `@jane/weather`, and an organisation `acme` publishes `@acme/…` through any of its public members. There is nothing to register: the CI checks that the author of the pull request is that account, or a public member of that organisation.

At your first Approval, the Maintainer records your account's numeric GitHub id in `namespaces.json`. If the account is later renamed, deleted or transferred, the Namespace is frozen until the Maintainer decides; a new account taking the old name never inherits it. `@tessello` is reserved.

## Hosting your package

The Marketplace never stores your `.zip`: you host it, and the listing pins it by its SHA-256.

- **Use GitHub Pages** (recommended), or `raw.githubusercontent.com`. The Host downloads the package from the User's browser, so the server must send CORS headers: GitHub Pages does, GitHub Releases does not.
- **One URL per version, never overwritten**, for example `https://jane.github.io/weather/weather-1.2.0.zip`. A published version never changes. If its file changes anyway, every install fails with "this package no longer matches the Marketplace".
- **Keep it online.** If you take a package down, installing that version fails.

## Your listing

Add a folder `modules/<namespace>/<name>/` holding `entry.json` and, if you like, up to three screenshots (PNG or WebP, 500 KB at most each). Everything else (name, description, icon, Permissions, Widgets, User guide) is read from the Manifest of your package.

```json
{
  "id": "@jane/weather",
  "source": "https://github.com/jane/weather",
  "license": "MIT",
  "tags": ["weather"],
  "screenshots": ["forecast.png"],
  "versions": [
    {
      "version": "1.0.0",
      "url": "https://jane.github.io/weather/weather-1.0.0.zip",
      "sha256": "<the SHA-256 of the .zip, 64 lowercase hex characters>"
    }
  ]
}
```

Compute the SHA-256 with `shasum -a 256 weather-1.0.0.zip` (macOS, Linux) or `Get-FileHash weather-1.0.0.zip` (Windows, then lower-case it). The full format, and every error code the CI can report, is described in the [`@tessello/marketplace` README](https://github.com/craftskillz/tessello/blob/main/packages/marketplace/README.md).

## What the CI checks

A pull request changes the files of a single listing folder, and nothing else. For each version it adds, the CI downloads the package (it never runs it) and checks that:

- the URL uses `https:`, and the package's SHA-256 is the one listed;
- the Validator finds no error, and the Manifest's `id` and `version` are those of the listing;
- the version is greater than every version before it, and published versions are unchanged;
- you own the Namespace, which is neither frozen nor banned, and the Module is not banned;
- the source repository is public, and GitHub reports the listed OSI-approved licence.

The CI comments on your pull request with what it found. Fix the problems and push again: the comment is updated.

## What happens next

- **A new Module** waits for the Maintainer's Approval. It may wait, and it may be declined.
- **A new version**, a change of tags or screenshots, or a Withdrawal, is merged automatically once the CI passes.
- **Anything else** goes to the Maintainer.

## Withdrawing

You can withdraw one of your Modules, or one of its versions, by a pull request that adds `"withdrawn": true` to it and changes nothing else. It is merged automatically, even if your source repository is no longer public. A withdrawn Module stays in the index, so that Hosts that installed it know, but Users no longer find it; a withdrawn version is no longer offered. Hosts tell their Users neutrally that the Creator withdrew it, and never uninstall it.

A Withdrawal never removes a Ban: a pull request that touches a `banned` mark is refused, whoever opens it. Taking a Withdrawal back goes to the Maintainer.

## Bans and frozen Namespaces

Only the Maintainer adds or lifts a Ban, on a version, a Module or a whole Namespace, and always gives the reason. A banned Module accepts no new version, and a banned Namespace accepts nothing. Hosts that installed a banned Module warn their Users with the reason; the Module keeps working until the User uninstalls it.

If the GitHub account of a Namespace is renamed, deleted or replaced by another account with the same name, the CI refuses every pull request of that Namespace and flags it to the Maintainer, who decides by hand. Until then the Namespace is frozen.

## Reporting a Module

Anyone can report a Module with the **Report a Module** issue template of this repository: the Module, the version concerned, the reason, and what happens. Reports are public, so do not include personal data. The Maintainer reads every report and decides, at their sole discretion, whether to ban a version, the Module or its Namespace. To report a security vulnerability privately, contact the Creator through the Module's source repository.
