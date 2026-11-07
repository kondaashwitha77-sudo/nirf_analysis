import type { ParamKey } from '../../types'

export const DATASET_LABEL = 'Demo / Mock Data'
export const MOCK_DISCLAIMER =
  'All figures on this screen are generated demo data. They are not actual NIRF results.'

export const YEARS = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
export const LATEST_YEAR = YEARS[YEARS.length - 1]

export const CATEGORIES = [
  'Overall',
  'University',
  'Engineering',
  'College',
  'Management',
  'Pharmacy',
  'Medical',
  'Law',
  'Architecture',
  'Research',
  'Innovation',
]

export const PARAMS: { key: ParamKey; label: string; full: string }[] = [
  { key: 'TLR', label: 'TLR', full: 'Teaching, Learning & Resources' },
  { key: 'RPC', label: 'RPC', full: 'Research & Professional Practice' },
  { key: 'GO', label: 'GO', full: 'Graduation Outcomes' },
  { key: 'QNR', label: 'QNR', full: 'Quantity / Quality metric (QNR)' },
  { key: 'QLR', label: 'QLR', full: 'Quality metric (QLR)' },
  { key: 'SFC', label: 'SFC', full: 'Student & Faculty Composition' },
  { key: 'OI', label: 'OI', full: 'Outreach & Inclusivity' },
  { key: 'Perception', label: 'Perception', full: 'Peer Perception' },
]

export const PARAM_KEYS = PARAMS.map((p) => p.key)

export interface StateInfo {
  name: string
  lat: number
  lon: number
  weight: number
}

/** Centroids are approximate; used only for the demo bubble map. */
export const STATES: StateInfo[] = [
  { name: 'Tamil Nadu', lat: 11.1, lon: 78.7, weight: 14 },
  { name: 'Maharashtra', lat: 19.7, lon: 75.7, weight: 14 },
  { name: 'Delhi', lat: 28.6, lon: 77.2, weight: 10 },
  { name: 'Karnataka', lat: 15.3, lon: 75.7, weight: 11 },
  { name: 'Uttar Pradesh', lat: 26.8, lon: 80.9, weight: 10 },
  { name: 'West Bengal', lat: 22.9, lon: 87.8, weight: 7 },
  { name: 'Telangana', lat: 17.9, lon: 79.1, weight: 7 },
  { name: 'Gujarat', lat: 22.3, lon: 71.2, weight: 6 },
  { name: 'Rajasthan', lat: 27.0, lon: 74.2, weight: 5 },
  { name: 'Kerala', lat: 10.5, lon: 76.3, weight: 5 },
  { name: 'Punjab', lat: 31.1, lon: 75.3, weight: 4 },
  { name: 'Haryana', lat: 29.1, lon: 76.1, weight: 4 },
  { name: 'Madhya Pradesh', lat: 23.5, lon: 78.3, weight: 4 },
  { name: 'Andhra Pradesh', lat: 15.9, lon: 79.7, weight: 5 },
  { name: 'Odisha', lat: 20.5, lon: 84.4, weight: 3 },
  { name: 'Bihar', lat: 25.6, lon: 85.6, weight: 2 },
  { name: 'Assam', lat: 26.2, lon: 92.9, weight: 2 },
  { name: 'Uttarakhand', lat: 30.1, lon: 79.2, weight: 2 },
  { name: 'Jharkhand', lat: 23.6, lon: 85.3, weight: 2 },
  { name: 'Chandigarh', lat: 30.7, lon: 76.8, weight: 2 },
]

export const STATE_CITIES: Record<string, string[]> = {
  'Tamil Nadu': ['Chennai', 'Coimbatore', 'Tiruchirappalli', 'Vellore'],
  Maharashtra: ['Mumbai', 'Pune', 'Nagpur'],
  Delhi: ['New Delhi'],
  Karnataka: ['Bengaluru', 'Mysuru', 'Dharwad', 'Mangaluru'],
  'Uttar Pradesh': ['Lucknow', 'Kanpur', 'Varanasi', 'Noida'],
  'West Bengal': ['Kolkata', 'Kharagpur', 'Durgapur'],
  Telangana: ['Hyderabad', 'Warangal'],
  Gujarat: ['Ahmedabad', 'Vadodara', 'Surat'],
  Rajasthan: ['Jaipur', 'Pilani', 'Jodhpur'],
  Kerala: ['Thiruvananthapuram', 'Kochi', 'Kozhikode'],
  Punjab: ['Ludhiana', 'Patiala'],
  Haryana: ['Gurugram', 'Sonipat'],
  'Madhya Pradesh': ['Bhopal', 'Indore'],
  'Andhra Pradesh': ['Visakhapatnam', 'Tirupati'],
  Odisha: ['Bhubaneswar', 'Rourkela'],
  Bihar: ['Patna'],
  Assam: ['Guwahati'],
  Uttarakhand: ['Roorkee', 'Dehradun'],
  Jharkhand: ['Ranchi', 'Jamshedpur'],
  Chandigarh: ['Chandigarh'],
}

/** How many institutions each category lists per year in the demo set. */
export const CATEGORY_SIZE: Record<string, number> = {
  Overall: 100,
  University: 60,
  Engineering: 70,
  College: 70,
  Management: 50,
  Pharmacy: 40,
  Medical: 35,
  Law: 30,
  Architecture: 25,
  Research: 30,
  Innovation: 30,
}

export const CATEGORY_LABEL: Record<string, string> = {
  Overall: 'Overall Institute',
  University: 'University',
  Engineering: 'Engineering Institute',
  College: 'College',
  Management: 'Management Institute',
  Pharmacy: 'Pharmacy Institute',
  Medical: 'Medical Institute',
  Law: 'Law School',
  Architecture: 'Architecture School',
  Research: 'Research Institute',
  Innovation: 'Innovation Centre',
}

export const BAND_STYLE_CATEGORIES = ['College', 'Pharmacy', 'Law']
