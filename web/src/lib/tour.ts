const TOUR_SEEN_KEY = 'onboardingTourSeen';

export function getTourSeen(): boolean {
  return localStorage.getItem(TOUR_SEEN_KEY) === 'true';
}

export function setTourSeen() {
  localStorage.setItem(TOUR_SEEN_KEY, 'true');
}
