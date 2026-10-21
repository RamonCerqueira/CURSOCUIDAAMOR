/** Percentual vazio preserva a regra legada da turma; zero dispensa nota. */
export function parseApprovalPercentage(value: unknown): number | null {
  if (value == null || value === '') return null
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Informe um percentual entre 0 e 100.')
  if (typeof value === 'string' && !value.trim()) return null
  const percentage = Number(value)
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100 || Math.abs(percentage * 100 - Math.round(percentage * 100)) > 0.000001) {
    throw new Error('Informe um percentual entre 0 e 100, com até duas casas decimais.')
  }
  return percentage
}

/** As médias existentes estão na escala 0–10. */
export function approvalMinimumGrade(coursePercentage: unknown, classMinimum: unknown): number | null {
  if (coursePercentage != null) {
    const percentage = Number(coursePercentage)
    return percentage === 0 ? null : percentage / 10
  }
  return classMinimum == null || Number(classMinimum) === 0 ? null : Number(classMinimum)
}
