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
| `rel06.json` | Buddhism | A living religion | Description without judgement, sources that disagree on a date reported as a range, a teach-back that asks the learner to describe and not to argue, a note asking for a reader from the tradition |
| `eco07.json` | Money and banks | A topic where the usual textbook story is disputed | The textbook account and the central bank's account set side by side, a real-data chart, a worked example that follows one loan through a balance sheet |
| `art05.json` | Perspective | A technique with a dated invention | A worked example the learner does on paper, drawings that are themselves the subject, a `when` range, a misconception answered by other traditions |
| `mus05.json` | Harmony | A topic about sound, with no sound in the format | Arithmetic the learner can check, the learner sent to a keyboard to hear it, an explanation presented as the best current account of an open question, a source that could only be partly read and says so |
| `lit04.json` | How a poem works | A skill taught on one text | The `excerpt` part with a poem from 1609 quoted in full, a guess-first question answered by reading aloud, the writer's close reading labelled as a reading, a challenge that changes the text and asks what is lost |

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
- A religion or any belief people hold dear: use `rel06`, with `pol06` if there are rival camps.
- An institution or system people misunderstand (money, courts, vaccines): use `eco07`.
- A craft or technique the learner can try with their hands: use `art05`.
- Anything about sound, taste, touch or movement, where the page cannot carry the experience: use `mus05`.

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

## What the third batch changed

- **Sources disagree more often than you expect.** Two textbooks date the Buddha about sixty years apart. Two reference works date Brunelleschi's experiment five years apart. A textbook teaches a model of banking that the central bank says is misleading. The lesson reports the disagreement and says so in the notes. It never quietly picks one.
- **A source that cannot be read must say so.** One research paper blocked automated reading. The lesson uses only the passage that was seen, names what was not confirmed, and asks for the link to be opened by a person.
- **Describe a religion; do not grade it.** The lesson states what is taught and by whom, and keeps the writer's comparisons labelled as the writer's. The notes ask for a reader from inside the tradition.
- **Some subjects need the learner's hands or ears.** The perspective lesson's worked example is a drawing exercise. The harmony lesson sends the learner to a keyboard. Neither needed a new part in the format, which matters once an app is built on that format.
- **Narrow questions make research cheap.** Asking each source a short list of specific questions, and drawing with a handful of reusable shapes, cut the effort for this batch to a fraction of the earlier ones. The pipeline's fact extraction and visual templates rest on the same idea.
