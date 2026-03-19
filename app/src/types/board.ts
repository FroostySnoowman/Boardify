export type BoardCardData = {
  id: string;
  title: string;
  subtitle?: string;
  labelColor?: string;
};

export type BoardColumnData = {
  title: string;
  cards: BoardCardData[];
};
