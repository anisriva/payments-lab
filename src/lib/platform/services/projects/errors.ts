export class ProjectNotFoundError extends Error {
  constructor(id: string) { super(`Project not found: ${id}`); this.name = 'ProjectNotFoundError'; }
}
export class ProjectNameTakenError extends Error {
  constructor(name: string) { super(`Project name taken: ${name}`); this.name = 'ProjectNameTakenError'; }
}
