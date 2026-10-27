export type ScoredQuestion = {
  id: string
  marks: number
  correctOptionId: string
}

export type ChosenAnswer = {
  questionId: string
  optionId: string
}

// Unanswered questions score zero. A correct option scores that question's marks. No partial credit.
// private.submit_test_attempt stores the same total.
export function scoreAnswers(questions: ScoredQuestion[], answers: ChosenAnswer[]): number {
  const chosen = new Map(answers.map((answer) => [answer.questionId, answer.optionId]))
  return questions.reduce((total, question) => {
    return total + (chosen.get(question.id) === question.correctOptionId ? question.marks : 0)
  }, 0)
}
