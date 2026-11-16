# Demo pieces

The site ships with no demo pieces. Add your own:

1. Put each MIDI file in `demos/src/`, for example `demos/src/mozart-k525.mid`. The file name with
   no `.mid` is the id of the piece, and a link with `#demo=<id>` opens it.
2. Add one entry for the piece to `demos/demos.json`. The order of the list is the order of the
   demo list, and the first entry is the piece of the start page.

   ```json
   [
     {
       "id": "mozart-k525",
       "title": "Eine kleine Nachtmusik, K. 525: I",
       "composer": "Wolfgang Amadeus Mozart",
       "credit": "Score: Mutopia Project, piece 2230, public domain."
     }
   ]
   ```

   `credit` shows in the credits dialog. An entry can also have `links`, a list of
   `{ "text": "...", "href": "..." }`, for example the source and the license of a CC BY file.
3. Run `pnpm build` (or push to `main`, and the Pages workflow builds the site).

`pnpm build` (the step `tools/patch-demos.ts`) also helps you:

- A file in `demos/src/` with no entry gets one at the end of `demos/demos.json`, with the file name
  as its title. Edit the title and the composer after.
- An entry with no `lengthSec` gets the length of its score.

Optional:

- `demos/patches.json` changes the program (the instrument) of the program changes of one track of
  a file, for example `[{ "file": "x.mid", "setProgram": [{ "track": 8, "program": 42 }] }]`.
- A row `| \`src/<file>\` | \`<sha-256>\` |` in a table of this file makes the build check the
  checksum of that file.

Check the license of each MIDI file before you publish it.
