import { type Project, type User, type Task } from './types';

/** Stable UUIDs — match `backend/migrations/20260427120000_seed_demo.sql` (Postgres seed). */
export const MOCK_USER_ALEX = 'a2000000-0000-4000-8000-000000000001';
export const MOCK_USER_SAM = 'a2000000-0000-4000-8000-000000000002';
export const MOCK_USER_JORDAN = 'a2000000-0000-4000-8000-000000000003';

export const MOCK_PROJECT_LAUNCH = 'b1000000-0000-4000-8000-000000000001';
export const MOCK_PROJECT_MIGRATION = 'b1000000-0000-4000-8000-000000000002';

export const MOCK_COL_LAUNCH_TODO = 'c1000000-0000-4000-8000-000000000001';
export const MOCK_COL_LAUNCH_PROGRESS = 'c1000000-0000-4000-8000-000000000002';
export const MOCK_COL_LAUNCH_REVIEW = 'c1000000-0000-4000-8000-000000000003';
export const MOCK_COL_LAUNCH_DONE = 'c1000000-0000-4000-8000-000000000004';

export const MOCK_COL_MIG_BACKLOG = 'c2000000-0000-4000-8000-000000000001';
export const MOCK_COL_MIG_DEV = 'c2000000-0000-4000-8000-000000000002';
export const MOCK_COL_MIG_STAGING = 'c2000000-0000-4000-8000-000000000003';
export const MOCK_COL_MIG_PROD = 'c2000000-0000-4000-8000-000000000004';

export const MOCK_TASK_TYPOGRAPHY = 'd1000000-0000-4000-8000-000000000001';
export const MOCK_TASK_DARKMODE = 'd1000000-0000-4000-8000-000000000002';
export const MOCK_TASK_USER_TEST = 'd1000000-0000-4000-8000-000000000003';
export const MOCK_TASK_LEGACY_API = 'd2000000-0000-4000-8000-000000000001';
export const MOCK_TASK_STAGING_K8S = 'd2000000-0000-4000-8000-000000000002';

/** UTC ms aligned with seed `created_at` / `updated_at` / `due_at` columns */
const T = {
  projLaunch: 1768046400000, // 2026-01-10 12:00
  projMigration: 1768467600000, // 2026-01-15 09:00
  taskTypoCreated: 1768834800000, // 2026-01-19 15:00
  taskTypoUpdated: 1768917600000, // 2026-01-20 14:00
  taskTypoDue: 1769083200000, // 2026-01-22 12:00
  commentTypo: 1768917600000, // 2026-01-20 14:00
  taskDarkCreated: 1768737600000, // 2026-01-18 12:00
  taskDarkDue: 1769342400000, // 2026-01-25 12:00
  taskTestCreated: 1768564800000, // 2026-01-16 12:00
  taskTestUpdated: 1768824000000, // 2026-01-19 12:00
  taskTestDue: 1768564800000, // 2026-01-16 12:00
  taskLegacyCreated: 1768471200000,
  taskLegacyUpdated: 1768647600000,
  taskLegacyDue: 1769619600000,
  taskK8sCreated: 1768572000000,
  taskK8sUpdated: 1768728600000,
  taskK8sDue: 1769763600000,
};

export const MOCK_USERS: User[] = [
  { id: MOCK_USER_ALEX, name: 'Alex Rivera', email: 'alex@example.com', role: 'Lead Developer' },
  { id: MOCK_USER_SAM, name: 'Sam Chen', email: 'sam@example.com', role: 'Product Designer' },
  { id: MOCK_USER_JORDAN, name: 'Jordan Taylor', email: 'jordan@example.com', role: 'QA Engineer' },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: MOCK_PROJECT_LAUNCH,
    name: 'Kanflow product launch',
    description: 'Modernizing the core platform with a focus on usability and speed.',
    ownerId: MOCK_USER_ALEX,
    createdAt: T.projLaunch,
    memberIds: [MOCK_USER_ALEX, MOCK_USER_SAM, MOCK_USER_JORDAN],
    columns: [
      { id: MOCK_COL_LAUNCH_TODO, title: 'To Do', order: 0 },
      { id: MOCK_COL_LAUNCH_PROGRESS, title: 'In Progress', order: 1 },
      { id: MOCK_COL_LAUNCH_REVIEW, title: 'Review', order: 2 },
      { id: MOCK_COL_LAUNCH_DONE, title: 'Done', order: 3 },
    ],
  },
  {
    id: MOCK_PROJECT_MIGRATION,
    name: 'Back-end Migration',
    description: 'Moving from legacy servers to a cloud-native architecture.',
    ownerId: MOCK_USER_ALEX,
    createdAt: T.projMigration,
    memberIds: [MOCK_USER_ALEX],
    columns: [
      { id: MOCK_COL_MIG_BACKLOG, title: 'Backlog', order: 0 },
      { id: MOCK_COL_MIG_DEV, title: 'Developing', order: 1 },
      { id: MOCK_COL_MIG_STAGING, title: 'Staging', order: 2 },
      { id: MOCK_COL_MIG_PROD, title: 'Production', order: 3 },
    ],
  },
];

export const MOCK_TASKS: Task[] = [
  {
    id: MOCK_TASK_TYPOGRAPHY,
    projectId: MOCK_PROJECT_LAUNCH,
    title: 'Finalize core typography',
    description: 'Establish the type scales and font pairings for the new design system.',
    status: MOCK_COL_LAUNCH_PROGRESS,
    priority: 'high',
    assigneeId: MOCK_USER_SAM,
    tags: ['design', 'system'],
    comments: [
      {
        id: 'e1000000-0000-4000-8000-000000000001',
        userId: MOCK_USER_ALEX,
        userName: 'Alex Rivera',
        content: "Let's stick with Inter for sans-serif.",
        createdAt: T.commentTypo,
      },
    ],
    dueDate: T.taskTypoDue,
    createdAt: T.taskTypoCreated,
    updatedAt: T.taskTypoUpdated,
    dependencies: [],
  },
  {
    id: MOCK_TASK_DARKMODE,
    projectId: MOCK_PROJECT_LAUNCH,
    title: 'Implement Dark Mode',
    description: 'Add support for system-level dark mode switching.',
    status: MOCK_COL_LAUNCH_TODO,
    priority: 'medium',
    assigneeId: MOCK_USER_ALEX,
    tags: ['feature'],
    comments: [],
    dueDate: T.taskDarkDue,
    createdAt: T.taskDarkCreated,
    updatedAt: T.taskDarkCreated,
    dependencies: [MOCK_TASK_TYPOGRAPHY],
  },
  {
    id: MOCK_TASK_USER_TEST,
    projectId: MOCK_PROJECT_LAUNCH,
    title: 'User Testing: Prototype A',
    description: 'Recruit 5 participants for a remote usability study.',
    status: MOCK_COL_LAUNCH_DONE,
    priority: 'low',
    assigneeId: MOCK_USER_JORDAN,
    tags: ['testing'],
    comments: [],
    dueDate: T.taskTestDue,
    createdAt: T.taskTestCreated,
    updatedAt: T.taskTestUpdated,
    dependencies: [],
  },
  {
    id: MOCK_TASK_LEGACY_API,
    projectId: MOCK_PROJECT_MIGRATION,
    title: 'Inventory legacy APIs',
    description: 'Catalog REST and SOAP endpoints still serving production traffic.',
    status: MOCK_COL_MIG_BACKLOG,
    priority: 'high',
    assigneeId: MOCK_USER_ALEX,
    tags: ['discovery', 'api'],
    comments: [],
    dueDate: T.taskLegacyDue,
    createdAt: T.taskLegacyCreated,
    updatedAt: T.taskLegacyUpdated,
    dependencies: [],
  },
  {
    id: MOCK_TASK_STAGING_K8S,
    projectId: MOCK_PROJECT_MIGRATION,
    title: 'Provision staging cluster',
    description: 'Stand up k8s namespace and secrets mirror for pre-prod validation.',
    status: MOCK_COL_MIG_DEV,
    priority: 'medium',
    assigneeId: MOCK_USER_SAM,
    tags: ['infra', 'k8s'],
    comments: [],
    dueDate: T.taskK8sDue,
    createdAt: T.taskK8sCreated,
    updatedAt: T.taskK8sUpdated,
    dependencies: [],
  },
];
