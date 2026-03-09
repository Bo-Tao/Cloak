import { create } from 'zustand'
import type { Project } from '../../../shared/types'

interface ProjectState {
  projects: Project[]
  activeProject: Project | null

  setProjects: (projects: Project[]) => void
  setActive: (project: Project | null) => void
  addProject: (project: Project) => void
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: [],
  activeProject: null,

  setProjects: (projects) => set({ projects }),

  setActive: (project) => set({ activeProject: project }),

  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
}))
