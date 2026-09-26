# Realistic dance studio revision — 26 September 2026

The user requested a realistic dancer scene in a blue, on-brand dance studio instead of the stylised sound-system sculpture. The homepage's `/#turn-it-up` section now uses a photorealistic fictional adult street dancer in a navy/cyan studio with a timber dance floor. The original logo is a separate exact `BrandLogo` asset, not generated into the image.

## Motion scope

This revision is a photographic projection scene with a small, scroll-driven camera dolly. It is **not a rigged human mesh or moving choreography**. The Blender sources explicitly record this distinction. The pinned section, scroll reversal, pause button, skip link, reduced-motion still and WebGL fallback remain.

Higgsfield returned `Session expired` when checking video access. An asynchronous request to run `higgsfield auth login` is pending. Do not claim the dancer's body is animated unless a subsequent video generation has completed and been integrated.

## Assets

- `public/media/tde-dance-studio.jpg` — landscape studio artwork.
- `public/media/tde-dance-studio-mobile.jpg` — portrait composition of the same dancer and moment.
- `public/models/tde-dance-studio.glb` and `tde-dance-studio-mobile.glb` — Blender photographic projection plates (about 290 KB each), only the matching aspect variant loads.
- `design/blender/create_dance_studio.py` — reproducible projection scene and camera keys.
- `design/blender/tde-dance-studio.blend` and `tde-dance-studio-mobile.blend` — packed editable Blender scenes.

The images were created using the built-in image-generation tool and encoded as JPEG with `sips`. The original PNGs remain under the generated-images directory. No real student, coach or school venue is depicted. Real school photography elsewhere is unchanged. Design sources stay excluded from Vercel uploads.

## Final generation prompts

Landscape, built-in generation:

> Use case: photorealistic-natural. Create a premium photorealistic website scene for The Dance Exclusive, a current, fun street-dance school. A REALISTIC ADULT street dancer in a beautiful blue on-brand dance rehearsal studio. Wide landscape 16:9 composition at high resolution. One adult woman in her twenties, full body including both trainers completely visible, placed just right of centre around 65% across the image. She is caught in a confident grounded hip-hop groove: one foot stepping sideways, knees bent naturally, one arm extended and the other bent with relaxed realistic hands, expressive joyful concentration. Real human anatomy and photographic skin texture; athletic but ordinary believable proportions. Oversized black streetwear T-shirt, loose charcoal cargo trousers, clean light trainers, subtle cyan-blue clothing accent. No fashion runway pose, no ballet, no floating or extreme acrobatics. The dancer is a fictional model, not a real Dance Exclusive coach or student. Studio: believable premium UK commercial dance studio, matte deep navy walls, light oak sprung dance floor with restrained blue light reflections, architectural cyan LED strips around the rear wall and ceiling, soft ceiling beams and one side wall receding in perspective. Brand blue #00B0E0 with dark ink navy #050E1B, NO PINK OR PURPLE. Large uncluttered darker wall space on the left 35% for later HTML headlines. Real lighting: neutral soft key light gives the face and clothing true details; blue edge light and very light atmospheric haze add depth, never a nightclub fog wall. High-end sports campaign photography, 35mm lens, slightly low camera, crisp dancer with subtle natural motion in clothing, physically believable shadows beneath shoes. Studio fills the entire frame; no borders. No words, letters, logos, emblems, captions, watermark, boombox, speakers or abstract floating objects. Keep the dancer and their entire body inside the middle-right 50% so it can crop vertically for mobile. This will be integrated into a scroll-responsive website scene; produce only the photographic scene.

Portrait, built-in edit with the generated landscape as reference:

> Create a portrait mobile companion image to this exact scene. Preserve the same adult dancer's appearance, clothing, grounded hip-hop pose, realistic proportions, blue LED dance studio, light oak floor, lighting and photographic style. Recompose and extend the studio into a tall 9:16 portrait frame. The complete dancer, both hands and both trainers must fit comfortably inside the central 85 percent of the width, with natural perspective and feet clearly on the floor. Leave the upper 20 percent as dark navy studio/ceiling for a later HTML headline and leave a little floor below her feet for controls. No text, no logo, no new people, no pink/purple, no abstract objects. Photorealistic sports campaign still, not illustration or CGI. This is a new framing of the same moment, not a change of person or pose.

## Verification

301 tests pass. Application TypeScript and changed-file ESLint pass. Desktop (1440px) and phone (390px) browser review confirms the correct composition, working WebGL projection, original logo, no runtime errors and no horizontal overflow. WCAG A/AA scans are clear for the checked scene layouts. Additional production and deployment checks are recorded below after completion.

The client/server production build passes. A fresh reduced-motion production browser creates no WebGL canvas and makes no GLB requests; the regular production browser loads the scene without runtime errors. Scroll progress reaches 0.651 while the section remains pinned at top 0, with no horizontal overflow. The built-in image generation mode was used for both assets; no image API/CLI fallback was used.
