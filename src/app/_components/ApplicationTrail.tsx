/**
 * The landing page's one moving picture: a single application going from
 * posting to interview.
 *
 * On load, requirements in the posting are highlighted the way a job seeker
 * marks up an ad, the resume match fills, a tailored cover letter slides out,
 * and the job travels along the pipeline stages the app actually uses. It
 * plays once and rests. With reduced motion it shows the finished state.
 *
 * Server component, no client JavaScript: the sequence is CSS animations with
 * staggered delays (see the "application trail" utilities in globals.css).
 * The company is fictional so the page never implies a real endorsement.
 */

const STAGES = ["Saved", "Applied", "Screening", "Interview", "Assessment", "Offer"];
const CURRENT_STAGE = 3;
const MATCH_PERCENT = 87;

const PEN_START_MS = 300;
const PEN_STEP_MS = 250;
const BAR_DELAY_MS = 1050;
const LETTER_DELAY_MS = 1500;
const TRAIL_DELAY_MS = 1900;
const STAGE_STEP_MS = 400;

function Mark({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <mark
      className="pen-mark animate-pen rounded-sm bg-transparent px-0.5 text-foreground"
      style={{ animationDelay: `${PEN_START_MS + index * PEN_STEP_MS}ms` }}
    >
      {children}
    </mark>
  );
}

/** The posting being marked up, with the cover letter sliding out behind it. */
export function PostingStack() {
  return (
    <figure className="w-full">
      <figcaption className="sr-only">
        Example application: a job posting with its key requirements
        highlighted and an {MATCH_PERCENT} percent resume match, a cover letter drafted for
        it, and the job moving along the pipeline to the interview stage.
      </figcaption>

      <div aria-hidden="true">
        <div className="relative mx-auto max-w-xl pb-16 lg:mr-0">
          {/* Tailored cover letter, sliding out from behind the posting */}
          <div
            className="animate-letter-out absolute inset-x-6 top-24 -bottom-2 translate-x-4 rotate-2 rounded-xl border border-border bg-card p-5 shadow-md"
            style={{ animationDelay: `${LETTER_DELAY_MS}ms` }}
          >
            <div className="absolute inset-x-5 bottom-4">
              <p className="text-sm font-medium text-card-foreground">
                Cover letter drafted
              </p>
              <p className="text-xs text-muted-foreground">
                Tailored to Northwind Labs. Export as DOCX or LaTeX.
              </p>
            </div>
          </div>

          {/* The posting */}
          <article className="relative rounded-xl border border-border bg-card p-5 shadow-lg sm:p-6">
            <h2 className="text-base font-semibold text-card-foreground">
              Senior Product Engineer
            </h2>
            <p className="text-sm text-muted-foreground">Northwind Labs, remote</p>

            <p className="mt-4 text-sm leading-relaxed text-card-foreground">
              You will build customer-facing features in{" "}
              <Mark index={0}>TypeScript and React</Mark>, shape our{" "}
              <Mark index={1}>design system</Mark>, and{" "}
              <Mark index={2}>own work end to end</Mark>, from the first spec
              to the metrics after launch.
            </p>

            <div className="mt-5 flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Resume match</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="animate-fill-bar h-full rounded-full bg-foreground"
                  style={{ width: `${MATCH_PERCENT}%`, animationDelay: `${BAR_DELAY_MS}ms` }}
                />
              </div>
              <span className="text-sm font-semibold tabular-nums text-card-foreground">
                {MATCH_PERCENT}%
              </span>
            </div>
          </article>
        </div>
      </div>
    </figure>
  );
}

/**
 * The pipeline the job travels along: full stage labels and a moving card
 * from md up, a compact progress line on phones. Decorative; the posting's
 * caption already describes the outcome.
 */
export function StageTrail() {
  return (
    <div aria-hidden="true" className="w-full">
      <div className="hidden md:block">
        <div className="relative grid grid-cols-6">
          {/* The line runs between the first and last stage centres. */}
          <div
            className="absolute top-2 h-px bg-border"
            style={{ left: `${100 / 12}%`, right: `${100 / 12}%` }}
          />
          {STAGES.map((stage, i) => {
            const reached = i <= CURRENT_STAGE;
            return (
              <div key={stage} className="relative flex flex-col items-center gap-2">
                <span
                  className={
                    reached
                      ? "animate-stage-on size-4 rounded-full border-2 border-foreground bg-foreground"
                      : "size-4 rounded-full border-2 border-border bg-background"
                  }
                  style={
                    reached
                      ? { animationDelay: `${TRAIL_DELAY_MS + i * STAGE_STEP_MS}ms` }
                      : undefined
                  }
                />
                <span
                  className={
                    i === CURRENT_STAGE
                      ? "text-sm font-medium text-foreground"
                      : "text-sm text-muted-foreground"
                  }
                >
                  {stage}
                </span>
              </div>
            );
          })}
        </div>

        <div className="relative mt-3 h-12">
          <div
            className="animate-trail-card absolute top-0 w-1/6 px-1"
            style={{
              left: `${(CURRENT_STAGE / STAGES.length) * 100}%`,
              animationDelay: `${TRAIL_DELAY_MS}ms`,
            }}
          >
            <div className="rounded-lg border border-border bg-card px-3 py-2 text-center shadow-sm">
              <p className="truncate text-xs font-medium text-card-foreground">
                Northwind Labs
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Interview on Thursday
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Phones: the same pipeline as a compact progress line */}
      <div className="flex items-center gap-3 md:hidden">
        <div className="flex flex-1 items-center gap-1">
          {STAGES.map((stage, i) => (
            <span
              key={stage}
              className={
                i <= CURRENT_STAGE
                  ? "h-1.5 flex-1 rounded-full bg-foreground"
                  : "h-1.5 flex-1 rounded-full bg-muted"
              }
            />
          ))}
        </div>
        <p className="text-sm text-foreground">
          {STAGES[CURRENT_STAGE]}
        </p>
      </div>
    </div>
  );
}
