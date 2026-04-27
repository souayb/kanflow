import { type Project, type User, type Task, type Notification } from './types';

// Initial Mock Data
export const MOCK_USERS: User[] = [
  { id: 'u1', name: 'Alex Rivera', email: 'alex@example.com', role: 'Lead Developer' },
  { id: 'u2', name: 'Sam Chen', email: 'sam@example.com', role: 'Product Designer' },
  { id: 'u3', name: 'Jordan Taylor', email: 'jordan@example.com', role: 'QA Engineer' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Kanflow product launch',
    description: 'Modernizing the core platform with a focus on usability and speed.',
    ownerId: 'u1',
    createdAt: Date.now() - 86400000 * 10,
    columns: [
      { id: 'c1', title: 'To Do', order: 0 },
      { id: 'c2', title: 'In Progress', order: 1 },
      { id: 'c3', title: 'Review', order: 2 },
      { id: 'c4', title: 'Done', order: 3 },
    ]
  },
  {
    id: 'p2',
    name: 'Back-end Migration',
    description: 'Moving from legacy servers to a cloud-native architecture.',
    ownerId: 'u1',
    createdAt: Date.now() - 86400000 * 5,
    columns: [
      { id: 'c1', title: 'Backlog', order: 0 },
      { id: 'c2', title: 'Developing', order: 1 },
      { id: 'c3', title: 'Staging', order: 2 },
      { id: 'c4', title: 'Production', order: 3 },
    ]
  }
];

export const MOCK_TASKS: Task[] = [
  {
    id: 't1',
    projectId: 'p1',
    title: 'Finalize core typography',
    description: 'Establish the type scales and font pairings for the new design system.',
    status: 'c2',
    priority: 'high',
    assigneeId: 'u2',
    tags: ['design', 'system'],
    comments: [
      { id: 'com1', userId: 'u1', userName: 'Alex Rivera', content: 'Let\'s stick with Inter for sans-serif.', createdAt: Date.now() - 3600000 }
    ],
    dueDate: Date.now() + 86400000 * 2,
    createdAt: Date.now() - 86400000,
    updatedAt: Date.now() - 3600000,
    dependencies: [],
  },
  {
    id: 't2',
    projectId: 'p1',
    title: 'Implement Dark Mode',
    description: 'Add support for system-level dark mode switching.',
    status: 'c1',
    priority: 'medium',
    assigneeId: 'u1',
    tags: ['feature'],
    comments: [],
    dueDate: Date.now() + 86400000 * 5,
    createdAt: Date.now() - 86400000 * 2,
    updatedAt: Date.now() - 86400000 * 2,
    dependencies: [],
  },
  {
    id: 't3',
    projectId: 'p1',
    title: 'User Testing: Prototype A',
    description: 'Recruit 5 participants for a remote usability study.',
    status: 'c4',
    priority: 'low',
    assigneeId: 'u3',
    tags: ['testing'],
    comments: [],
    dueDate: Date.now() - 86400000,
    createdAt: Date.now() - 86400000 * 4,
    updatedAt: Date.now() - 86400000 * 1,
    dependencies: [],
  }
];
