import test from "node:test";
import assert from "node:assert/strict";
import { STAGES } from "../public/rubrics.js";
import { addReportGuidance } from "../public/pitch-guidance.js";
import { improvementPlanHTML } from "../public/report-plan.js";
import { PITCH_SECONDS, FINAL_COUNTDOWN_SECONDS } from "../public/practice-config.js";

test("every stage has concrete guidance for every missing and unclear pitch point", () => {
  for (const stage of STAGES) {
    for (const status of ["missing", "weak"]) {
      const result = addReportGuidance(stage, stage.items.map(item => ({ id: item.id, title: item.title, status })));
      for (const point of result) {
        assert.equal(point.guidance.source, "rubric");
        assert.ok(point.guidance.gap && point.guidance.why && point.guidance.target);
        assert.ok(point.guidance.steps.length >= 2);
        assert.ok(point.guidance.steps.every(step => step.length > 25));
        assert.match(point.guidance.template, /\[.+\]/);
      }
    }
  }
});

test("complete personalised plans survive; malformed or incomplete plans are labelled checklist guidance", () => {
  const guidance = {
    gap: "Your pitch names creators but doesn't explain which group you will start with.",
    why: "A narrow first audience makes user research easier.",
    steps: ["Choose one creator segment you can reach.", "Speak with people in that group about their current workflow."],
    template: "We are starting with [specific creator segment] who [observed problem].",
  };
  const [personalized] = addReportGuidance(STAGES[0], [{ id: "customer", status: "weak", guidance }]);
  assert.equal(personalized.guidance.source, "personalized");
  assert.equal(personalized.guidance.gap, guidance.gap);
  const [incomplete] = addReportGuidance(STAGES[0], [{ id: "customer", status: "missing", guidance: { steps: [null, {}, "one step"] } }]);
  assert.equal(incomplete.guidance.source, "rubric");
  assert.ok(incomplete.guidance.steps.length >= 2);
  const [covered] = addReportGuidance(STAGES[0], [{ id: "customer", status: "covered", guidance }]);
  assert.equal(covered.guidance, null);
});

test("improvement plan escapes content and prioritises key missing points", () => {
  const points = addReportGuidance(STAGES[0], [
    { id: "validation", title: "Validation", must: false, status: "missing" },
    { id: "customer", title: "<script>unsafe</script>", must: true, status: "weak" },
    { id: "problem", title: "Problem", must: true, status: "missing" },
  ]);
  const esc = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = improvementPlanHTML(points, esc);
  assert.ok(html.indexOf('data-gap="problem"') < html.indexOf('data-gap="customer"'));
  assert.ok(html.indexOf('data-gap="customer"') < html.indexOf('data-gap="validation"'));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(PITCH_SECONDS, 300);
  assert.equal(FINAL_COUNTDOWN_SECONDS, 45);
});
