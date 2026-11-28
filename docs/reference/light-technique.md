# Light technique: the standard angles of stage light and film light

This file is the target of the light setups of the stage (design 4.5, light setups). It gives the
standard angles of a stage light and the standard setups of film and portrait light, with a source
for each fact.

**Upkeep.** This file is current. A change of the light setups (`src/scene/light-rigs.ts`) updates
section 3 "Use in the app" in the same commit. Each new fact gets its source.

**Source marks.** Each fact names its source by a number of section 4. "(derived)" marks a rule
that this file makes from the facts of its sources.

## 1. The angles of a stage light

- **Front light.** A light in front of the performer gives good visibility. Alone, it gives a flat
  look with few shadows. [1] [2]
- **Side light.** A light from the side shows the form and the movement of a body better than a
  front light. [1] [2]
- **Back light.** A light from behind separates the performer from the background, gives depth,
  and can give a silhouette. [1] [3]
- **Top light (down light).** A light from above lights the heads and the shoulders and gives
  strong shadows. A top light alone leaves the eye sockets dark. [1] [2]
- **Low front light (footlights).** A light from below the face gives an up light with unusual
  shadows. [2]
- **Cross light.** Two lights from opposite angles give volume. A key light at about 45° to the
  front and the side, and a second light at 45° from the other side, keep the eyes and the mouth
  clear. [2] [4]

## 2. The setups of film and portrait light

- **Three-point light.** A key light gives the main light and its direction. A weaker fill light on
  the other side makes the shadows of the key light lighter. A back light gives the outline. [5]
- **Split light.** A key light at about 90° to the side, at the height of the face, lights one half
  of the face. [6]
- **Butterfly light.** A key light above the camera and in line with it gives a small shadow under
  the nose. [6]
- **Layers.** One angle alone seldom gives a good result. A mix of front, side, back, and top light
  gives the most depth. [2]

## 3. Use in the app

- "Concert" is a three-point setup: the key light high at the front left, the fill light and the
  weak cross lights, and the rim light behind with its beam (derived from [5]).
- "Front light" turns the key light to the front at 45°, and gives more fill and cross light and
  less rim light (derived from [1]).
- "Side light" puts the key light low at the left side, with little fill and cross light, as split
  light on the stage (derived from [1] and [6]).
- "Top light" puts the key light almost overhead, with short shadows (derived from [1]).
- "Back light" makes the key light weak and the rim light strong (derived from [1] and [3]).
- "Cross light" puts the key light at 45° to the front and to the left, and makes the cross lights
  from the two front corners strong (derived from [4]).
- "Low front light" puts the key light low in front, so the shadows fall long to the back (derived
  from [2]).
- The switch "Center light" turns off the rim light behind the middle of the orchestra and its
  beam, for a look with no back light.

## 4. Sources

1. ETC, "Stage Lighting Design, Part 5: Lighting Angles".
   https://blog.etcconnect.com/stage-lighting-design-part-5
2. Betopper, "Stage Lighting Angles Explained: Front, Back, Side, Top and Uplight Guide".
   https://betopperdj.com/blogs/news/stage-lighting-angles-explained-front-back-side-top-uplight-guide
3. 4Wall, "What is the difference between front light, back light, and side light?".
   https://www.4wall.com/help/what-is-the-difference-between-front-light-back-light-and-side-light--n-192
4. SHEHDS, "The 45-Degree Rule in Stage Lighting".
   https://shehds.com/blogs/news/the-45-degree-rule-in-stage-lighting
5. Wikipedia, "Three-point lighting". https://en.wikipedia.org/wiki/Three-point_lighting
6. Wikipedia, "Photographic lighting". https://en.wikipedia.org/wiki/Photographic_lighting
