import { Competition, SportType } from './types';
import { ALL_COMPETITIONS } from './data';

export function getCompetitions(): Competition[] {
  const local = localStorage.getItem('added_competitions');
  let added: Competition[] = [];
  if (local) {
    try {
      added = JSON.parse(local);
    } catch (e) {}
  }
  return [...ALL_COMPETITIONS, ...added];
}

export function addCompetition(comp: Competition): void {
  const local = localStorage.getItem('added_competitions');
  let added: Competition[] = [];
  if (local) {
    try {
      added = JSON.parse(local);
    } catch (e) {}
  }
  added.push(comp);
  localStorage.setItem('added_competitions', JSON.stringify(added));
}
