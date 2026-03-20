export type BoardListItem = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  updatedAt: string;
};

export const MOCK_BOARDS: BoardListItem[] = [
  {
    id: '1',
    name: 'Work',
    color: '#a5d6a5',
    createdAt: '2025-01-10T12:00:00.000Z',
    updatedAt: '2026-03-01T09:00:00.000Z',
  },
  {
    id: '2',
    name: 'Personal',
    color: '#F3D9B1',
    createdAt: '2025-06-20T15:30:00.000Z',
    updatedAt: '2026-03-15T18:20:00.000Z',
  },
  {
    id: '3',
    name: 'Side project',
    color: '#b8c5ff',
    createdAt: '2026-02-01T10:00:00.000Z',
    updatedAt: '2026-02-28T12:00:00.000Z',
  },
];

export function boardLabelForId(id: string | null | undefined): string {
  if (id == null || id === '') return 'None';
  const b = MOCK_BOARDS.find((x) => x.id === id);
  return b?.name ?? id;
}
