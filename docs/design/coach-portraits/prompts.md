# TDE coach portraits — 27 September 2026

Mode: built-in GPT Image, identity-preserving edits of the 12 published coach photos.
Original staff uploads remain unchanged. These are AI-edited photographic portraits,
not a newly commissioned photo shoot. First names and source IDs come from the public school feed.

## Base prompt

Edit this supplied coach photograph for The Dance Exclusive website. Identity-preserve: keep the exact same real person, facial geometry, expression, eyes, teeth, skin texture, hair, pose and existing clothing, including any existing clothing artwork. Do not beautify or invent another face. Remove the circular crop completely and extend the photograph naturally to a full rectangular portrait, 4:5 aspect ratio, waist/chest-up composition, entire head visible with comfortable headroom. Replace only the old background with a clean contemporary dance-studio photographic backdrop in vivid TDE cyan blue #00b0e0, subtle darker blue depth near the edges and restrained cool studio light. Natural skin tones, soft frontal light, crisp editorial dance-crew photography. Uniform centered head-and-upper-body framing. No circular frame, no border, no pink, no additional people, no props, no new lettering or logos, no typography. Preserve existing clothing faithfully. This is a polished photographic background/crop edit, not an illustration. Output one portrait.

## Series prompt

For every coach after Amie, append the following, substituting their first name:

The FIRST reference is {name}'s source photograph: preserve only that person's identity, age and outfit. The SECOND reference is the finished art direction: match its blue background, light quality and rectangular composition only, NEVER its face or clothing. Keep the source pose and individual character; do not change the person's age.

## Files and presentation

- Original public source filenames and final web assets: `src/lib/coachPortraits.json`.
- Original URL prefix: `https://suwaetnsszlpaaykhpif.supabase.co/storage/v1/object/public/staff-photos/`.
- Web delivery: `public/media/coaches/{first-name}-blue-v1.jpg`, 1000px maximum dimension, JPEG quality 85.
- The first generated Amie portrait is the visual reference for the other 11 edits.
- Each person is generated separately from their own inspected source photograph.
- Names, roles and biography text remain real HTML. No new text or logos were requested in the photographs.
- A source-filename match gates each override. New staff photo uploads automatically take precedence.
- Public grid, biography dialogs and individual coach pages use the rectangular portraits.
- Homepage timetable removed; class directory and booking timetables preserved.
