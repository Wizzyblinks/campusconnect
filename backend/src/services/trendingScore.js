export const calculateTrendingScore = ({
  likes = 0,
  comments = 0,
  shares = 0,
  ageHours = 0,
}) => {
  const ageInDays = Math.max(0, ageHours / 24);
  const engagement = likes * 2 + comments * 3 + shares * 4;
  const recencyBonus = 10 * Math.exp(-ageInDays / 3);
  return Math.round((engagement + recencyBonus) * 100) / 100;
};
