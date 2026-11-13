# Model lessons

These lessons were written by hand, with sources open, to show the pipeline what a good lesson looks like for different kinds of topic. When the pipeline drafts a new lesson, give it the one or two models closest in kind, not all of them.

| File | Topic | Kind of topic | What it demonstrates |
| --- | --- | --- | --- |
| `lrn01.json` | The forgetting curve | A finding from one famous experiment | Real data as a chart, a myth corrected from the primary source, the writer's reasoning kept apart from sourced fact |
| `phi12.json` | Free will | An open question with rival answers | The `positions` part, a guess-first question about the debate itself, recall items that test the arguments and not a verdict, a teach-back that fails anyone who says the matter is settled |
| `phy07.json` | Entropy | An abstract idea that is usually explained badly | Building the idea from a count the learner can do by hand, a bar chart of that count, a sourced worked example with numbers, an estimation challenge |
| `his04.json` | First cities and writing | A story about the past, told through one case | A causal chain labelled as one reading of the evidence, the `when` field, a scholarly disagreement reported without choosing a side, five cross-field connections |
| `prb04.json` | Conditional probability and Bayes | A method the learner has to carry out | The guess-first question is the problem itself, a second worked example that changes one number, recall items that require a calculation, invented figures labelled as invented |
| `mat12.json` | Infinity | A proof, with nothing to measure | Each card is one step of an argument, a worked example the learner can repeat with their own digits, a challenge that asks what is wrong with a tempting objection |
| `bio09.json` | Evolution by natural selection | A process that is widely misread | The mechanism reduced to three facts and one consequence, a worked example with invented numbers and a chart of them, four named misreadings, wording that never says organisms try or need |
| `pol06.json` | Political ideologies | Living political disagreement | `positions` with the best argument and main objection for each of four views, one event reasoned through four ways, a teach-back that fails caricature, a challenge to argue the side you like least |
| `lit04.json` | How a poem works | A skill taught on one text | The `excerpt` part with a poem from 1609 quoted in full, a guess-first question answered by reading aloud, the writer's close reading labelled as a reading, a challenge that changes the text and asks what is lost |

Three more are planned (a religion, money and banking, and a topic in art or music), which will make twelve.

The addresses each lesson was written from are in `pipeline/sources/<topic_id>.txt`, so the pipeline can be tested on the same topics with the same sources. See "Qualifying a model" in `docs/RESEARCH_PROTOCOL.md`.

## Choosing a model for a new topic

- A question philosophers, historians or scientists still dispute: use `phi12`.
- A physical or mathematical idea with no single experiment behind it: use `phy07`.
- A period, event or civilisation: use `his04`.
- A calculation or technique: use `prb04`.
- A single study or discovery: use `lrn01`.
- A proof or a logical argument: use `mat12`.
- A natural process or mechanism: use `bio09`, with `phy07` if it needs counting.
- Anything people vote about: use `pol06`, and `phi12` for the structure of `positions`.
- A poem, a painting, a piece of music or any single work to be read closely: use `lit04`.

## What writing the first five taught

- **Contested topics need their own part.** Without `positions`, a lesson on an open question drifts toward a verdict. With it, each view gets a claim, its best argument and its main objection.
- **The guess-first question can always be factual.** For Free will it asks which view most philosophers hold, which has an answer, where "do we have free will?" does not.
- **Reasoning must be labelled.** Every lesson has analogies and examples that go beyond its sources. Each says so in the text where it matters and lists them in `verification.notes`.
- **Drawings fail in one common way: labels that collide or run off the edge.** The validator now estimates the width of each label and rejects a drawing whose text probably does not fit. A person still has to look at every drawing once.
- **Short labels, few words.** A drawing with more than about fifteen words is a diagram trying to be a paragraph. Put the words in the card text.
- **Invented numbers are fine in examples if they are called invented.** Real figures need a source, and the two must never be mixed in one table.

## What the second batch changed

- **One source is not research.** Three of the first five lessons rested on a single source or a single book. Each now has an independent second source, and the validator refuses to mark a lesson verified with fewer than two.
- **Sources need names.** One early lesson cited a paper by its database number alone. Every source now carries its authors, title and year.
- **Some topics are about a text.** A lesson on poetry cannot paraphrase the poem. The `excerpt` part holds the text, limited to works published before 1929 or openly licensed.
- **Political topics need the same care on every side.** For each view the lesson gives the argument its supporters would recognise and the objection its critics would press, in the same number of words and the same tone. The notes ask for a reader from each side.
- **A close reading is the writer's, and says so.** No source supports "this line slows down here". The lesson presents such points as observations the learner can test by reading aloud, and the notes list them.
- **Research depth must not depend on who is writing.** That is now `docs/RESEARCH_PROTOCOL.md`.
