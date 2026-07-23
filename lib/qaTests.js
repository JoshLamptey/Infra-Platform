export const QA_TESTS = [
  { section: "1. Signing in", items: [
    { id: "s1", action: "Open the app's website link in your browser.", expected: "A page appears asking for your email address, with a button like \"Send sign-in link.\"" },
    { id: "s2", action: "Type your email address and press the button to send the link.", expected: "The page shows a message telling you to check your email." },
    { id: "s3", action: "Open your email inbox (check spam/junk too) for the sign-in email.", expected: "An email arrives within about a minute with a sign-in link." },
    { id: "s4", action: "Click the link in the email.", expected: "You're taken back to the app and can see your email address near the top — you're signed in." },
  ]},
  { section: "2. Signing out", items: [
    { id: "so1", action: "Find \"sign out\" near the top of the page and click it.", expected: "You're taken back to the sign-in page." },
    { id: "so2", action: "After signing out, try using your browser's back button.", expected: "You do NOT get back into the app — you should stay on, or be sent back to, the sign-in page." },
  ]},
  { section: "3. Look & feel", items: [
    { id: "l1", action: "Look at the browser tab at the top of your screen.", expected: "The tab shows a small icon and a title like \"Infra Console.\"" },
    { id: "l2", action: "Look at the overall colors of the site.", expected: "Nothing looks broken, misaligned, or like leftover placeholder colors." },
  ]},
  { section: "4. Your learning pipeline (the weeks list)", items: [
    { id: "p1", action: "After signing in, look at the main page.", expected: "You see a list of weeks, each with a week number and a title." },
    { id: "p2", action: "Look closely at the most recent taught week.", expected: "It looks \"open\" — an unlocked padlock icon, and it stands out visually." },
    { id: "p3", action: "Look closely at weeks that haven't been taught yet.", expected: "They look dimmed/muted, each with a closed padlock icon and text like \"locks until taught.\"" },
    { id: "p4", action: "Try clicking or tapping on a locked week.", expected: "Nothing happens — you can't open it." },
  ]},
  { section: "5. Opening a week", items: [
    { id: "w1", action: "Click on an unlocked week.", expected: "You land on a page with that week's learning content (text, headings, maybe a table)." },
    { id: "w2", action: "Look for a way to get back to the list of weeks.", expected: "There's a clear \"back\" link that returns you to the pipeline page." },
    { id: "w3", action: "Look for a quiz section on the week's page.", expected: "You see a box mentioning a quiz, with a \"Take quiz\" button." },
  ]},
  { section: "6. Taking a quiz", items: [
    { id: "q1", action: "Click \"Take quiz.\"", expected: "You see one or more questions, each with a text box to type an answer." },
    { id: "q2", action: "Type an answer and submit it.", expected: "After a few seconds, a score and written feedback appear." },
    { id: "q3", action: "Leave the quiz page, then come back to it.", expected: "Your answer and score are still shown — you're not asked to answer again." },
    { id: "q4", action: "On an already-graded question, click \"Try again.\"", expected: "The answer box appears again, blank — you can submit a fresh answer." },
    { id: "q5", action: "Click \"Retake entire quiz\" at the top of a quiz you've already done.", expected: "After confirming, every question resets to a blank answer box." },
  ]},
  { section: "7. Checking your progress (analytics)", items: [
    { id: "a1", action: "Click \"analytics\" near the top of the page.", expected: "A page appears summarizing your quiz results, like an average score." },
    { id: "a2", action: "Check the numbers shown make sense.", expected: "The scores roughly match what you actually got on the quiz(zes) you've taken." },
  ]},
  { section: "8. Trying it on your phone", items: [
    { id: "m1", action: "Open the same website link on your phone.", expected: "The site loads and looks reasonable — text isn't cut off, buttons are easy to tap." },
    { id: "m2", action: "Look at the top bar (header) on your phone specifically.", expected: "The icons/links at the top don't look crowded or overlapping — there's breathing room between them." },
    { id: "m3", action: "Sign in and open a week on your phone.", expected: "Everything from the earlier steps still works on a smaller screen." },
  ]},
  { section: "9. Bonus checks (optional — skip if this isn't your thing)", items: [
    { id: "b1", action: "Type the web address of a locked week's page directly into the browser, instead of clicking it (ask the site owner for the link if needed).", expected: "You get sent back to the pipeline page — typing the address doesn't get you in either." },
    { id: "b2", action: "Check the project's GitHub Actions tab after a recent change was pushed.", expected: "The checks show green/passing, not red/failing." },
    { id: "b3", action: "Ask the site owner whether any secret keys are visible in the page's source code.", expected: "Nothing that looks like a password or long random key appears anywhere in the visible page code." },
  ]},
];

export function allTestIds() {
  return QA_TESTS.flatMap((g) => g.items.map((i) => i.id));
}

export function findTest(id) {
  for (const group of QA_TESTS) {
    const item = group.items.find((i) => i.id === id);
    if (item) return { ...item, section: group.section };
  }
  return null;
}