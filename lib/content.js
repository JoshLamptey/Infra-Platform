import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const MODULES_DIR = path.join(process.cwd(), "content/modules");
const QUIZZES_DIR = path.join(process.cwd(), "content/quizzes");

/**
 * @typedef {Object} ModuleContent
 * @property {string} slug
 * @property {string} title
 * @property {number} order
 * @property {string} body
 */

/**
 * @typedef {Object} QuizQuestion
 * @property {string} id
 * @property {'mcq'|'open'} type
 * @property {string} prompt
 * @property {{id: string, label: string}[]} [options]
 * @property {string} [rubric]
 * @property {number} maxScore
 */

/**
 * @typedef {Object} QuizContent
 * @property {string} slug
 * @property {string} moduleSlug
 * @property {string} title
 * @property {QuizQuestion[]} questions
 */

/** @returns {ModuleContent[]} */
export function getAllModules() {
  const files = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(MODULES_DIR, file), "utf-8");
      const { data, content } = matter(raw);
      return {
        slug: data.slug,
        title: data.title,
        order: data.order,
        body: content,
      };
    })
    .sort((a, b) => a.order - b.order);
}

/** @returns {ModuleContent|undefined} */
export function getModule(slug) {
  return getAllModules().find((m) => m.slug === slug);
}

/** @returns {QuizContent|undefined} */
export function getQuiz(slug) {
  const filePath = path.join(QUIZZES_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  return JSON.parse(fs.readFileSync(filePath, "utf-8"));
}

/** @returns {QuizContent|undefined} */
export function getQuizForModule(moduleSlug) {
  const files = fs.readdirSync(QUIZZES_DIR).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const quiz = JSON.parse(fs.readFileSync(path.join(QUIZZES_DIR, file), "utf-8"));
    if (quiz.moduleSlug === moduleSlug) return quiz;
  }
  return undefined;
}
