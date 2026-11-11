const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    if (force === undefined) force = !this.contains(value);
    if (force) this.add(value); else this.remove(value);
    return force;
  }
}
class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.hidden = false;
    this.style = {};
    this.children = [];
    this.classList = new FakeClassList();
    this.attributes = new Map();
    this.events = new Map();
    this.dataset = {};
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = [...children]; }
  addEventListener(event, callback) { this.events.set(event, callback); }
  click() { if (!this.hidden) this.events.get('click')?.(); }
  focus() { this.focused = true; }
  querySelectorAll(selector) {
    return selector === '.answer-option' ? this.children.filter(e => e.className === 'answer-option') : [];
  }
}

function boot() {
  const ids = [
    'stage', 'introScreen', 'quizScreen', 'startButton', 'nextButton',
    'chapterLabel', 'questionCounter', 'progressBar', 'progressFill',
    'questionTheme', 'questionText', 'answerList', 'answerHint',
    'quizBody', 'finale', 'finaleContent', 'finalTitle',
  ];
  const elements = Object.fromEntries(ids.map(id => [id, new FakeElement()]));
  elements.nextButton.hidden = true;
  elements.quizScreen.hidden = true;
  elements.finale.hidden = true;
  const timeouts = [];
  const window = {
    scrollTo() {},
    setTimeout(callback, delay) { timeouts.push({ callback, delay }); },
  };
  const document = {
    getElementById(id) { return elements[id]; },
    createElement(tag) { return new FakeElement(tag); },
    body: new FakeElement('body'),
  };
  const sandbox = { window, document };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/questions.js'), 'utf8'), sandbox);
  vm.runInNewContext(fs.readFileSync(path.join(root, 'js/app.js'), 'utf8'), sandbox);
  function tick(delay) {
    const index = timeouts.findIndex(entry => entry.delay === delay);
    assert.notEqual(index, -1, `Expected timer ${delay} ms`);
    timeouts.splice(index, 1)[0].callback();
  }
  return { elements, questions: window.QUIZ_QUESTIONS, tick, pendingTimeouts: timeouts };
}

test('Alle zehn Fragen besitzen drei Antwortmöglichkeiten und genau vier Themenkapitel', () => {
  const { questions } = boot();
  assert.equal(questions.length, 10);
  for (const question of questions) {
    assert.equal(question.answers.length, 3);
    assert.ok(question.question.length > 15);
    assert.ok(question.answers.every(answer => answer.length > 20));
  }
  assert.deepEqual([...new Set(questions.map(q => q.chapterNumber))], ['I', 'II', 'III', 'IV']);
});

test('Weiter erscheint erst nach einer Auswahl; Antworten bleiben vor dem Weiterklicken änderbar', () => {
  const { elements: e } = boot();
  e.startButton.click();
  assert.equal(e.introScreen.hidden, true);
  assert.equal(e.quizScreen.hidden, false);
  assert.equal(e.nextButton.hidden, true);
  assert.equal(e.answerList.children.length, 3);

  e.answerList.children[0].click();
  assert.equal(e.nextButton.hidden, false);
  assert.equal(e.answerList.children[0].getAttribute('aria-pressed'), 'true');
  e.answerList.children[2].click();
  assert.equal(e.answerList.children[0].getAttribute('aria-pressed'), 'false');
  assert.equal(e.answerList.children[2].getAttribute('aria-pressed'), 'true');
});

test('Alle zehn Fragen werden einzeln mit Weiter bestätigt; Finale bleibt dauerhaft stehen', () => {
  const { elements: e, questions, tick, pendingTimeouts } = boot();
  e.startButton.click();

  for (let i = 0; i < questions.length; i++) {
    assert.equal(e.questionText.textContent, questions[i].question);
    assert.equal(e.questionCounter.textContent, `${String(i + 1).padStart(2, '0')} / 10`);
    assert.equal(e.progressBar.getAttribute('aria-valuenow'), String(i + 1));
    assert.equal(e.nextButton.hidden, true, `Next should be hidden on question ${i + 1}`);
    e.answerList.children[i % 3].click();
    e.nextButton.click();
    if (i < questions.length - 1) tick(220);
  }

  assert.equal(e.stage.hidden, true);
  assert.equal(e.finale.hidden, false);
  assert.equal(e.finalTitle.focused, true);
  assert.equal(e.finale.classList.contains('is-vanishing'), false);
  assert.equal(e.finaleContent.hidden, false);
  assert.equal(pendingTimeouts.length, 0, 'No disappearance timer should be scheduled');
});

test('Die finalen HTML-Inhalte enthalten keinen Neustart- oder Navigationsbutton', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const finale = html.split('<section class="finale"')[1].split('</section>')[0];
  assert.match(finale, /Lebst du für dich selbst/);
  assert.match(finale, /Lade diese Seite neu, um den Fragebogen erneut zu starten/);
  assert.doesNotMatch(finale, /<button\b|<a\b|<input\b/i);
});
