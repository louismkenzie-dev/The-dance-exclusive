---
target: Dance Exclusive homepage
total_score: 24
max_score: 36
na_heuristics: 7
p0_count: 0
p1_count: 1
target_identity: "file:/Users/louismckenzie/.codex/worktrees/06b4/Dance Exclusive/src/pages/Index.tsx"
target_fingerprint: "sha256:920f36eabb0f39c6fd380db7cd938866f72d2c9bf7fae334bed69954dc486018"
target_path: /Users/louismckenzie/.codex/worktrees/06b4/Dance Exclusive/src/pages/Index.tsx
timestamp: 2026-09-26T22-44-09Z
slug: src-pages-index-tsx
closed: true
---
Method: dual-agent (A: /root/design_review · B: /root/evidence_review)

The homepage now feels like a dance brand, but it does not yet deliver the premium, distinctive experience in the brief. Its strongest material is the real dancers. Its weakest moments are repeated atmosphere copy and a functioning 3D scene whose art direction does not match the quality of that real footage.

Scope: current homepage preview and src/pages/Index.tsx; desktop 1280×720 and mobile 390×844. This is a critique, not a code change or a complete accessibility audit.

## Design specificity

The original logo, blue identity, Essex locations, actual classes and real performance imagery make this recognisably Dance Exclusive. Pink is confined to adult content. The repeated slogan-and-card structures could still belong to a gym or youth sports brand. The opportunity is to make the choreography, pacing and story as specific as the people.

The static detector returned zero findings for Index.tsx and the marketing components. Browser review nevertheless found usability issues in responsive CSS and navigation. A clean scan is not a design-quality or accessibility certification.

## Design health

| Heuristic | Score /4 | Main finding |
|---|---:|---|
| System status | 3 | Loading copy and motion controls exist. |
| Real-world language | 3 | Practical class details, with some school-specific terminology. |
| User control | 3 | Pause, skip and Escape work; mobile menu close target is small. |
| Consistency | 3 | Clear audience colours; generic class link filters to children. |
| Error prevention | 2 | Homepage suggestions omit age eligibility. |
| Recognition | 3 | Strong initial choices; practical reassurance is less prominent. |
| Efficiency | n/a | Expert shortcuts are not material to this persuasion homepage. |
| Aesthetic focus | 2 | Repetition and long sections dilute the strongest material. |
| Error recovery | 3 | Source includes plain-language fallbacks; failures not induced. |
| Help | 2 | Help routes exist, but first-class reassurance is distant. |
| **Total** | **24/36, 67%** | **Acceptable; significant improvements needed.** |

This is a heuristic judgment, not a measured conversion score.

## What works

- The real performance hero establishes street dance and place immediately, with clear children/adult actions. Both mobile buttons measure 310×49px.
- The blue branding is recognisable and avoids the rejected newspaper-like direction. Adult pink has a clear role.
- The team grid meets the brief: 12 coaches, three columns on desktop, Amie centred and labelled Founder. Her biography opens, closes with Escape, and restores focus correctly.

## Priority issues

1. **P1: Make class discovery genuinely useful.** The audience-neutral “Explore classes” link filters to children; all four sampled suggestions are children’s classes. Rows omit age eligibility, and mobile hides day/time entirely. Parents cannot assess suitability efficiently, and adults lose representation after the balanced hero. Fix the link wording or destination, add a children/adults switch for relevant suggestions, and retain verified age, venue, day and time. Source: Index.tsx:190, :205, :226; public-site.css:1236. Suggested command: `$impeccable clarify` followed by `$impeccable adapt`.

2. **P2: Give the Blender scene an authored purpose.** The mannequin visibly changes poses and the camera moves. The issue is artistic: glossy toy-like materials and an empty room feel less premium than the real dancers. Three chapter labels promise more progression than the scene delivers, across 210svh of desktop scroll. Keep the requested moving Blender scene, but storyboard three distinct beats using studio lighting, sound equipment, floor markings and spatial transformation. Match scroll length to the payoff. A realistic person is unnecessary. Suggested command: `$impeccable shape`, then `$impeccable animate`.

3. **P2: Replace repeated mood-setting with a progressing story.** “Find your crew”, “Your space. To move”, “Dance. Grow. Achieve” and “There’s something about this place” repeat belonging before resolving first-class questions. The mobile page is approximately 11,965px tall. Give each section a separate job: choose an audience, see authentic proof, understand a first class, choose a location, meet the team. Bring verified reassurance earlier and tighten repetition elsewhere. Preserve the requested complete coach grid. Suggested command: `$impeccable distill`.

4. **P2: Organise location discovery around the visitor.** Seven venues plus “All 15 locations” is an arbitrary data-order excerpt; Chelmsford appears twice. Group by town, then reveal venues and relevant classes, while keeping an all-locations route. Suggested command: `$impeccable layout`.

5. **P2: Make mobile navigation dismissal easy to tap.** Its close control measures 16×16px, versus 44×44px for opening. Give it a minimum 44×44px hit area and preserve Escape/focus behaviour. Source: src/components/ui/sheet.tsx:60. Suggested command: `$impeccable adapt`.

## Visitor experience

Cognitive load is moderate: three checklist failures around competing mid-page emphasis, long link groups and location choices. Hierarchy and grouping are otherwise clear. The requested coach grid is not inherently excessive choice: visitors can browse faces without making a twelve-way decision.

The emotional path starts strongly with authentic performance, becomes practical at the timetable, loses continuity in the synthetic studio, and regains warmth through real community imagery. Later repetition stretches the journey before the final class invitation.

- First-time parent: needs age suitability and first-class expectations near class selection.
- Adult beginner: gets an adult hero button, then a children-only timetable sample and generic link.
- Distracted mobile visitor: loses day/time information, faces a very long page and a small menu-dismiss target.

## Smaller observations and limits

- Mobile hero has a large gap before the main heading; primary buttons still fit onscreen.
- The final “See you on the floor” would benefit from an explicit “Find your class” label.
- Generic missing-bio copy should be replaced by approved staff copy, not invented biography.
- No horizontal overflow or console errors were observed. Console warnings report Supabase build-time configuration fallbacks and a deprecated Three.js shadow-map option; neither prevented rendering or data loading.
- This review did not test checkout transactions, screen readers, network throttling or full contrast compliance.

## Questions to guide the next pass

1. Priority: class discovery and mobile usability; Blender art direction; or homepage story and pacing?
2. Scope: top three issues; or all five?
