export function improvementPlanHTML(checklist, esc) {
  const priority = point => (point.must ? 0 : 2) + (point.status === "missing" ? 0 : 1);
  const gaps = checklist.filter(point => point.status !== "covered" && point.guidance)
    .sort((a, b) => priority(a) - priority(b));
  return `<section class="sec" aria-labelledby="improvementHeading">
    <div class="sec-title"><h3 id="improvementHeading">What to improve, and how</h3></div>
    <p class="muted plan-intro">This is about what your pitch explained—not a judgement of your startup. Start with one point, gather what you need, then practise that part again.</p>
    ${gaps.length ? `<div class="gap-plan-grid">${gaps.map((point, index) => {
      const guide = point.guidance;
      return `<article class="card gap-plan" data-gap="${esc(point.id)}">
        <div class="row"><span class="pill ${point.status === "missing" ? "warn" : "accent"}">${point.status === "missing" ? "Add this point" : "Make this clearer"}</span>${index === 0 ? '<span class="small plan-priority">Start here</span>' : ""}</div>
        <h4>${esc(point.title)}</h4>
        <p class="small muted">${guide.source === "personalized" ? "Tailored to this pitch" : "Stage-checklist guidance"}</p>
        <div class="plan-part"><h5>What wasn't clear</h5><p>${esc(guide.gap)}</p></div>
        <div class="plan-part"><h5>What to aim for at your stage</h5><p>${esc(guide.target)}</p></div>
        <div class="plan-part"><h5>Why it matters</h5><p>${esc(guide.why)}</p></div>
        <div class="plan-part"><h5>How to work on it</h5><ol>${guide.steps.map(step => `<li>${esc(step)}</li>`).join("")}</ol></div>
        <div class="plan-template"><h5>A starting point for your next pitch</h5><p>${esc(guide.template)}</p><small>Replace the [placeholders] with your facts. If something is untested, say so.</small></div>
      </article>`;
    }).join("")}</div>` : '<div class="card"><h4>You explained every checklist point.</h4><p class="muted">Use the refinements below to make your next version clearer and easier to follow. Covered doesn’t mean there’s nothing left to test.</p></div>'}
  </section>`;
}
