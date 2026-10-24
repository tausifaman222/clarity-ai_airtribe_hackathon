// Concrete stage-checklist guidance is also available when AI is offline or
// an older saved report has no personalised improvement plan.
const GUIDES = {
  problem: {
    why: "A clear problem helps someone understand why your product needs to exist.",
    steps: ["Name one specific person or business with this problem, and the situation in which it happens.", "Describe what they do today and the cost in time, money or effort. Use a real example if you have one.", "If you haven't spoken with users yet, say that. Interview people in this group before presenting the problem as validated."],
    template: "[Specific users] struggle with [problem] when [situation]. Today they use [workaround], which costs them [observed impact]. We learned this from [real observation or interview].",
  },
  customer: {
    why: "A narrow first audience makes your idea easier to understand and test.",
    steps: ["Choose the first group you can realistically reach, rather than everyone who might use the product.", "Describe their role, context and the moment they need help.", "Explain how you will find and speak with people in that group."],
    template: "We're starting with [specific group] who [relevant situation]. We can reach them through [actual channel or community].",
  },
  solution: {
    why: "Listeners need to understand what your product does before they can judge its value.",
    steps: ["Explain the main job your product does in one sentence, without a list of features.", "Walk through one user's before-and-after experience.", "Compare the result with their current alternative. If the benefit isn't measured yet, describe how you will test it."],
    template: "[Product] helps [first users] do [specific job] by [simple explanation]. Unlike [current alternative], it [benefit we have observed or will test].",
  },
  founderFit: {
    why: "Relevant experience explains why you understand this problem and can make progress on it.",
    steps: ["Name the experience, skill or access you actually have that relates to this problem.", "Give one concrete example of what you learned or built.", "Be open about a skill you still need, and how you plan to cover it."],
    template: "I know this problem because [real experience]. I've [relevant work or learning], which helps us [specific advantage]. Our next skill gap is [gap], and we're addressing it by [plan].",
  },
  validation: {
    why: "A small, clear test shows how you will turn an assumption into evidence.",
    steps: ["Choose the riskiest assumption: whether users have the problem, want the solution, or will pay.", "Design one small test, such as interviews, a manual pilot or a prototype trial.", "Set a date and a measurable signal that will help you decide what to do next. Don't describe a planned test as a completed result."],
    template: "Our biggest assumption is [assumption]. By [date], we'll test it with [group] using [experiment]. We'll look for [chosen success signal] before deciding to [next decision].",
  },
  whyNow: {
    why: "A specific change explains why this opportunity is worth exploring now.",
    steps: ["Identify a change in user behaviour, technology, cost or regulation that matters to this problem.", "Find a dated observation or reliable source supporting that change.", "Connect the change to what users can do now that they couldn't do before. Label an untested interpretation as an assumption."],
    template: "[Specific change] has made [new behaviour or capability] possible. We see this in [real observation or source], and we're testing whether it leads to [opportunity].",
  },
  market: {
    why: "A grounded estimate shows whether your first audience can support a useful business.",
    steps: ["Define the first customer segment and geography instead of starting with a huge industry total.", "Estimate reachable customers using a source you can explain, then multiply by a realistic annual price.", "Show the calculation and label price, reach and conversion assumptions. Distinguish your starting segment from a possible larger market."],
    template: "We're starting with approximately [reachable customers, with source] in [segment]. At an assumed [annual price], that's [customers × price] per year. We still need to validate [key assumption].",
  },
  signals: {
    why: "Early signals help distinguish interest in the problem from interest in using or buying your product.",
    steps: ["Choose the strongest evidence you actually have: interviews, prototype use, pilots, paid use or repeat use.", "Give the count, date range and what people did—not just what they said.", "Explain the limits of this signal and the next stronger test. If you have no results yet, say what you plan to test."],
    template: "Between [dates], [number and type of users] [observable action]. This suggests [careful interpretation], but we haven't validated [remaining uncertainty].",
  },
  ask: {
    why: "A clear next step tells the listener what help you need and what that help will achieve.",
    steps: ["Say what you are asking this listener for. If you're raising funding, give the amount; otherwise be explicit about the help you need.", "Connect the resources to two or three specific activities rather than a broad ambition.", "Name the milestones and timeframe, and explain what you will know or achieve when you reach them."],
    template: "We're asking for [specific support or funding amount] to [activities] over [timeframe]. That should let us reach [measurable milestones].",
  },
  traction: {
    why: "Progress is more credible when the listener knows what was measured and over what period.",
    steps: ["Choose a metric that reflects real product use or customer value, not just attention.", "Give the current value, comparison period and definition. Separate paying customers, active users and sign-ups.", "Describe what the result does and doesn't prove. If usage is very early, share honest learning instead of inventing growth or revenue."],
    template: "As of [date], we have [defined usage or revenue metric]. Over [period], it changed from [actual starting value] to [actual current value]. The next thing we're testing is [uncertainty].",
  },
  businessModel: {
    why: "The user and the buyer may be different. Explaining both makes the business easier to assess.",
    steps: ["Name who uses the product and who would pay for it.", "Describe what they pay for, how often and at what current or proposed price.", "Say whether anyone has paid yet. If not, describe a concrete willingness-to-pay test and label the price as a hypothesis."],
    template: "[Buyer] pays [current or proposed price] per [unit or period] for [value]. We have validated [actual evidence], and still need to test [pricing assumption].",
  },
  competition: {
    why: "Users already have a way to handle the problem, even if that means a spreadsheet or doing nothing.",
    steps: ["Name the real alternatives your first users use today, including manual workarounds.", "Choose one difference that matters to those users rather than claiming to be better at everything.", "Support that difference with an observation, comparison or a test you plan to run."],
    template: "Today, [first users] use [alternatives]. We're focusing on [specific difference] because [user need or evidence]. We will verify the benefit with [comparison or test].",
  },
  gtm: {
    why: "A practical route to the first customers is more useful than a long list of possible marketing channels.",
    steps: ["Identify where your first customer group already looks for help or spends time.", "Pick one way to reach them and describe the action you will take.", "Share actual results if available. Otherwise set a small test and decide how you will measure responses, usage or paid conversion."],
    template: "We'll reach [first segment] through [specific channel] by [action]. We've seen [actual result, if any]. Our next test will measure [signal] over [timeframe].",
  },
  unitEconomics: {
    why: "Clear costs and margins show whether growth can become sustainable.",
    steps: ["State the period and definitions for acquisition cost, revenue and gross margin.", "Calculate acquisition cost from acquisition spending divided by new paying customers, and explain any lifetime-value assumptions.", "Show which inputs are observed and which are estimates. If data is too early, identify what you must measure next instead of presenting estimates as facts."],
    template: "For [period], acquisition cost was [spend ÷ new paying customers] and gross margin was [actual margin]. Our estimated payback is [calculation], based on [explicit assumptions].",
  },
  retention: {
    why: "Returning use helps explain whether people continue to get value after trying the product.",
    steps: ["Define a cohort: users or customers who started in the same period.", "Choose a meaningful return action and measure how many perform it after a stated interval.", "Show the count and percentage with the period. Avoid calling sign-ups or one-time visits retention."],
    template: "Of [cohort size] users who started in [period], [number or percentage] returned to [meaningful action] after [interval]. We define active use as [definition].",
  },
};
GUIDES.team = GUIDES.founderFit;
GUIDES.insight = GUIDES.whyNow;
GUIDES.moat = GUIDES.competition;
GUIDES.problemMarket = {
  why: "The listener needs to connect a specific customer problem with a credible starting market.",
  steps: ["Describe a specific customer segment and its observed problem.", "Estimate the reachable segment using a source and an explicit price assumption.", "Explain your initial focus and what evidence would justify expanding beyond it."],
  template: "[First segment] experiences [observed problem]. There are approximately [reachable customers, with source], and we are testing a price of [assumption]. We'll begin with [narrow focus].",
};
const clean = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export function addReportGuidance(stage, checklist) {
  return checklist.map(point => {
    const item = stage?.items.find(candidate => candidate.id === point.id);
    if (!item || point.status === "covered") return { ...point, guidance: null };
    const supplied = point.guidance || {};
    const steps = Array.isArray(supplied.steps) ? supplied.steps.map(step => clean(step, 450)).filter(Boolean).slice(0, 4) : [];
    const complete = clean(supplied.gap, 650) && clean(supplied.why, 450) && steps.length >= 2 && clean(supplied.template, 800);
    const base = GUIDES[item.id] || {
      why: "This point helps the listener understand your idea at its current stage.",
      steps: [item.good, "Add a real example or clearly label the assumption you still need to test."],
      template: "[Your specific answer, supported by real evidence or labelled as an assumption].",
    };
    return { ...point, guidance: {
      source: complete && supplied.source !== "rubric" ? "personalized" : "rubric",
      gap: complete ? clean(supplied.gap, 650) : clean(point.note, 650) || `Your explanation of ${item.title.toLowerCase()} needs ${point.status === "missing" ? "to be added" : "more detail"}.`,
      target: item.good,
      why: complete ? clean(supplied.why, 450) : base.why,
      steps: complete ? steps : base.steps,
      template: complete ? clean(supplied.template, 800) : base.template,
    } };
  });
}
