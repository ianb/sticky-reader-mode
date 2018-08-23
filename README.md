# Sticky Reader Mode

A browser extension that adds a preference to Reader Mode pages, which will default to using Reader Mode on that site.

Note: usually homepages won't be considered an "article" and so they won't default to Reader Mode.

## Installation

To test it out:

```sh
$ npm install
$ npm start
# Or if the wrong Firefox is used:
$ FIREFOX="/Application/Firefox Nightly.app" npm start
```

Then on `about:debugging` click **Load Temporary Add-on...** and select `addon/manifest.json`

Note that `web-ext run` does not work due to the permissions and experiment API this uses. You must manually reload through `about:debugging`, and note that `manifest.json.tmpl` edits won't be reflected by default.
