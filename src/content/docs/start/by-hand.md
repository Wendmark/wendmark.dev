---
title: "Write a flow by hand"
editUrl: https://github.com/Wendmark/wendmark/edit/main/docs/authoring-flows.md
---

Most processes are recorded from the portal: press **Record a process** on an
app's page, click through it in your app, then reword and publish it in the
portal. Writing one by hand is for everything else: trying Wendmark on an app
that has no portal behind it, or a flow kept next to your own tests.

## 1. Load the snippet

Serve it with `pnpm dev` (the portal serves it at `http://localhost:3100/snippet.js`),
then add one tag to the app you want to guide:

```html
<script src="http://localhost:3100/snippet.js" data-app="wm_yourappkey"></script>
```

The `data-app` key comes from the app's page in the portal. Without it the
snippet still works for hand-written flows, but the portal cannot tell that
it is installed.

For an app you cannot edit, paste the contents of `apps/portal/public/snippet.js`
into the browser console instead. Either way you end up with one global,
`window.Wendmark`.

## 2. Record it by clicking through it

```js
Wendmark.record({ name: 'Change your grind' })
// …click through the process. A "Recording" badge is shown the whole time.
const flow = Wendmark.stopRecording()
Wendmark.start(flow) // play it back immediately
```

The recorder captures structure and authored labels only: roles, names,
selectors, the section an element sits in and the page it was on. It never
records what you type, choose or tick.

What it gives you is a first draft. Expect to edit:

- **The wording.** "Click Save changes" is generated from the element; you can
  say something better.
- **Misclicks.** Delete steps you did not mean.
- **`dynamic: true`** on steps that target one of the user's own items.
- **Instruction steps**, added by hand where the user needs to read something
  rather than click.

## 3. Assemble the flow

```js
const flow = {
  schemaVersion: 1,
  id: 'change-grind',
  name: 'Change your grind to Espresso',
  steps: [
    {
      type: 'action',
      id: 'open-profile',
      text: 'Open your Profile', // what the user is told; you write this
      dynamic: false,
      target: {/* paste a captured fingerprint here */},
    },
    { type: 'instruction', id: 'pick', text: 'Choose Espresso from the list.' },
  ],
}
```

Rules worth knowing:

- **`text` is yours to write.** The fingerprint describes the element; the
  step's `text` is what the user reads.
- **`dynamic: true`** when the target is one of the user's own items (an order,
  a coffee, a row) rather than fixed UI. The player then highlights the whole
  group and lets the user choose.
- **Pages are stored as paths.** A step remembers `/profile`, not
  `http://localhost:5174/profile`, so a flow recorded on a laptop works in
  staging and production. Query strings are dropped: they carry data, and
  sometimes personal data.
- **Three kinds of step.** `action` (the user clicks something), `input` (the
  user fills a field in — it completes when they change it, and what they put
  in is never recorded), and `instruction` (text only, no target).
- **Less can be more.** `role` plus `name` often resolves better than a long
  selector, because it survives restyling. Trim anything that looks generated.

## 4. Play it

```js
Wendmark.start(flow)
Wendmark.stop()
```

If a step cannot be found, the panel says so and keeps looking; navigate to the
right screen and guidance resumes by itself.

## Where flows live today

| Where         | What                                                     |
| ------------- | -------------------------------------------------------- |
| The portal    | Processes recorded from it, edited there, and published  |
| Anywhere else | A `const` in a console session, or a JSON file you paste |
