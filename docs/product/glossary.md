# Glossary

The words the app uses on screen, and the dance terms its content relies on. Use these in app
text, the website, release notes and example content.

## App words

| On screen                | In code                 | Meaning                                                                                       |
| ------------------------ | ----------------------- | --------------------------------------------------------------------------------------------- |
| figure                   | `pattern`, `IPattern`   | One move or sequence of moves with a name. De _Figur_, es/pt _figura_, fr _figure_, ar حركة   |
| list                     | `IPatternList`          | A collection of figures with its own types and modifiers                                      |
| type                     | `PatternType`           | A family of figures (Push, Pass, Whip, Tuck in the WCS template), with a colour               |
| level                    | `PatternLevel`          | Beginner, Intermediate or Advanced; optional                                                  |
| prerequisite, builds on  | `prerequisites`         | A figure that should be learned before this one. "Builds into" is the reverse                 |
| foundational figure      | `foundational`          | A figure with no prerequisites                                                                |
| modifier                 | `IModifier`             | A change to how a figure is danced ("with inside turn"). Positions: Entry, During, Exit       |
| universal modifier       | `universal: true`       | A modifier that applies to every figure, with its own videos                                  |
| variant                  | `IPatternModifierRef`   | A figure danced with one attached modifier, with its own videos                               |
| counts                   | `counts`                | How many beats a figure takes                                                                 |
| rhythm                   | `rhythm`                | The step pattern over those beats, written `1 2 3&4 5&6`                                      |
| Map, Timeline, Network   | graph, `timeline`, `graph` | The tab and its two views                                                                  |
| list owner               | publisher, owner        | The person who publishes a list and edits it for everyone                                     |
| subscriber, follower     | subscriber              | Someone who follows a published list; their copy is read-only                                 |
| share code               | `shareCode`             | The 8-character code others use to follow a list                                              |
| members only             | `membersOnly`           | A published list only people let in can open                                                  |
| hand over                | handover                | Giving a published list to someone who follows it                                             |
| suggestion               | suggestion              | A figure, or a change to one, sent by a subscriber for the owner to review                    |
| Anonymized               | `generated`             | A video the app made to hide who dances in it                                                 |
| transcript               | `transcript`            | What was said in a video, written down on the phone                                           |

Avoid on screen: _pattern_ (except in the app's name, Dance Pattern Mapper), _publisher_,
_keeper_, _graph_, _node_.

## Dance terms (West Coast Swing)

Example content uses West Coast Swing. Be exact: check a name against a published syllabus before
using it, and never invent a figure.

- **Underarm Turn**, not "right side pass".
- **Whip** and **Left Side Pass** are both foundations; neither builds on the other.
- **Sugar Tuck** builds on Sugar Push. **Tuck Turn** (a passing tuck) is the left side pass with a
  tuck. The website copy says "traveling tuck".
- **Behind-the-Back Whip** exists. There is no "behind-the-back pass".
- **Reverse Whip** may be used as an example figure.
- A variation is a **modifier on the base figure**, not a new figure: Basic Whip plus "with Inside
  Turn", never an "Inside Turn Whip".
- **Hesitation** and **with Hand Change** fit any figure. **with Duck** fits only figures with an
  inside turn.
- **Tags** name a whole course ("Beginners 1") or a festival weekend, never a course week, since
  a group grows one list over years of courses.

Other dances follow the same rule: only a verified standard term or rhythm goes into a template.
Argentine tango has no basic rhythm on purpose.

Why: [0006](../decisions/0006-figure-on-screen-pattern-in-code.md), [0010](../decisions/0010-variations-are-modifiers.md).
