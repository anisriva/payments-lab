import type { PrismaClient } from '@/generated/prisma';
import { ProjectDAO } from '@/lib/platform/dao/projects/project-dao';
import { TEST_PROJECTS } from './data/test-projects';

export async function seedTestProjects(prisma: PrismaClient) {
  const projectDAO = new ProjectDAO(prisma);

  for (const project of TEST_PROJECTS) {
    const existing = await projectDAO.findByName(project.name);
    if (!existing) {
      await projectDAO.create(project);
    }
  }

  console.log(`✅ Seeded ${TEST_PROJECTS.length} test projects`);
}
