

import { HardwareSet, Door, Project, TeamMember, Role, HardwareItem } from './types';

export const initialHardwareSets: HardwareSet[] = [
  {
    id: 'hs-01',
    name: 'Standard Office',
    division: 'Division 08',
    description: 'Basic hardware for interior office doors.',
    items: [
      { id: 'item-01a', name: 'Hinges', quantity: 3, manufacturer: 'Stanley', description: 'Standard butt hinge', finish: 'Satin Chrome' },
      { id: 'item-01b', name: 'Lever Lockset', quantity: 1, manufacturer: 'Schlage', description: 'Office function lock', finish: 'Satin Chrome' },
      { id: 'item-01c', name: 'Door Closer', quantity: 1, manufacturer: 'LCN', description: 'Surface mounted closer', finish: 'Aluminum' },
      { id: 'item-01d', name: 'Wall Stop', quantity: 1, manufacturer: 'IVES', description: 'Concave wall bumper', finish: 'Satin Chrome' },
    ],
  },
  {
    id: 'hs-02',
    name: 'Restroom Set',
    division: 'Division 08',
    description: 'Hardware for public restroom doors with privacy lock.',
    items: [
      { id: 'item-02a', name: 'Hinges', quantity: 3, manufacturer: 'Stanley', description: 'Standard butt hinge', finish: 'Satin Chrome' },
      { id: 'item-02b', name: 'Privacy Lever', quantity: 1, manufacturer: 'Schlage', description: 'Privacy function with indicator', finish: 'Satin Chrome' },
      { id: 'item-02c', name: 'Door Closer', quantity: 1, manufacturer: 'LCN', description: 'Surface mounted closer', finish: 'Aluminum' },
      { id: 'item-02d', name: 'Coat Hook', quantity: 1, manufacturer: 'IVES', description: 'Single prong coat hook', finish: 'Satin Chrome' },
      { id: 'item-02e', name: 'Kick Plate', quantity: 1, manufacturer: 'Rockwood', description: '8" kick plate', finish: 'Satin Stainless Steel' },
    ],
  },
   {
    id: 'hs-03',
    name: 'Fire-Rated Stairwell',
    division: 'Division 08',
    description: 'Heavy-duty, fire-rated hardware for stairwell doors.',
    items: [
      { id: 'item-03a', name: 'Heavy-Duty Hinges', quantity: 3, manufacturer: 'McKinney', description: 'Ball bearing hinge', finish: 'Satin Stainless Steel' },
      { id: 'item-03b', name: 'Fire-Rated Exit Device', quantity: 1, manufacturer: 'Von Duprin', description: 'Rim exit device, fire-rated', finish: 'Satin Stainless Steel' },
      { id: 'item-03c', name: 'Heavy-Duty Door Closer', quantity: 1, manufacturer: 'LCN', description: 'Heavy-duty closer for high traffic', finish: 'Dark Bronze' },
    ],
  },
];

export const initialDoors: Door[] = [
    { 
      id: 'd-01', 
      doorTag: '101', 
      location: 'OFFICE',
      interiorExterior: 'Interior',
      quantity: 1,
      liftCount: 1,
      operation: 'Swing',
      fireRating: '20 Min',
      width: 36,
      height: 84,
      thickness: 1.75,
      doorMaterial: 'Wood',
      frameMaterial: 'Hollow Metal',
      hardwarePrep: 'Cylindrical Lock',
      schedule: 'A', 
      type: 'Wood Office Door', 
      status: 'pending' 
    },
    { 
      id: 'd-02', 
      doorTag: '102', 
      location: 'RESTROOM',
      interiorExterior: 'Interior',
      quantity: 1,
      liftCount: 1,
      operation: 'Swing',
      fireRating: 'N/A',
      width: 36,
      height: 84,
      thickness: 1.75,
      doorMaterial: 'Hollow Metal',
      frameMaterial: 'Hollow Metal',
      hardwarePrep: 'Cylindrical Lock, Closer',
      schedule: 'A', 
      type: 'Hollow Metal Restroom Door', 
      status: 'pending' 
    },
    { 
      id: 'd-03', 
      doorTag: 'ST-01', 
      location: 'STAIR 1',
      interiorExterior: 'Interior',
      quantity: 1,
      liftCount: 1,
      operation: 'Swing',
      fireRating: '90 Min',
      width: 42,
      height: 96,
      thickness: 1.75,
      doorMaterial: 'Hollow Metal',
      frameMaterial: 'Hollow Metal',
      hardwarePrep: 'Mortise Lock, Exit Device',
      schedule: 'Stairs', 
      type: 'Stairwell Fire Door', 
      status: 'pending' 
    },
];

// Dynamically set a due date 5 days from now for the demo project
const futureDate = new Date();
futureDate.setDate(futureDate.getDate() + 5);
const dueDateISO = futureDate.toISOString().split('T')[0];
// Format the date to match the screenshot 'YYYY-MM-DD'
const mockDueDate = `${futureDate.getFullYear()}-11-22`;


export const initialProjects: Project[] = [
  {
    id: 'proj-3',
    name: 'Downtown Office Tower',
    description: 'Full hardware estimation for a new 40-story high-rise.',
    lastModified: new Date().toISOString().split('T')[0],
    hardwareSets: [],
    doors: [],
    client: 'Major Corp',
    dueDate: dueDateISO,
    status: 'Active',
    projectNumber: '2023-001'
  },
  {
    id: 'proj-1',
    name: 'Downtown Medical Center',
    description: 'Renovation of the main hospital wing.',
    lastModified: '2024-07-28',
    hardwareSets: initialHardwareSets,
    doors: initialDoors,
    client: 'General Hospital Group',
    dueDate: '2025-03-15',
    status: 'Active',
    projectNumber: '2023-105'
  },
  {
    id: 'proj-2',
    name: 'Northgate High School',
    description: 'New construction for the science and arts building.',
    lastModified: '2024-07-25',
    hardwareSets: [],
    doors: [],
    client: 'Public School District',
    dueDate: '2024-12-20',
    status: 'Complete',
    projectNumber: '2023-098'
  }
];

export const initialTeamMembers: TeamMember[] = [
  { id: 'tm-1', name: 'Alice Johnson', email: 'alice@example.com', role: Role.Administrator, status: 'Active', lastActive: '2024-07-29' },
  { id: 'tm-2', name: 'Bob Williams', email: 'bob@example.com', role: Role.SeniorEstimator, status: 'Active', lastActive: '2024-07-28' },
  { id: 'tm-3', name: 'Charlie Brown', email: 'charlie@example.com', role: Role.Estimator, status: 'Active', lastActive: '2024-07-25' },
  { id: 'tm-4', name: 'Diana Prince', email: 'diana@example.com', role: Role.Estimator, status: 'Pending', lastActive: '' },
];

export const initialMasterInventory: HardwareItem[] = [
    { id: 'inv-001', name: 'Hinges', quantity: 0, manufacturer: 'Stanley', description: 'Standard butt hinge', finish: 'Satin Chrome' },
    { id: 'inv-002', name: 'Lever Lockset', quantity: 0, manufacturer: 'Schlage', description: 'Office function lock', finish: 'Satin Chrome' },
    { id: 'inv-003', name: 'Door Closer', quantity: 0, manufacturer: 'LCN', description: 'Surface mounted closer', finish: 'Aluminum' },
];
