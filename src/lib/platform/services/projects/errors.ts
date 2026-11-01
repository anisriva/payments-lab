export class ProjectNotFoundError extends Error {
  constructor(id: string) { super(`Project not found: ${id}`); this.name = 'ProjectNotFoundError'; }
}
export class ProjectNameTakenError extends Error {
  constructor(name: string) { super(`Project name taken: ${name}`); this.name = 'ProjectNameTakenError'; }
}
export class ProjectInUseError extends Error {
  constructor(message: string) { super(message); this.name = 'ProjectInUseError'; }
}
