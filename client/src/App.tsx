import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { SiteLayout } from './components/layout/SiteLayout';
import { PageSkeleton } from './components/ui/misc';
import { RequireStaff } from './lib/auth';
import Home from './pages/Home';

// Customer pages load fast on mobile data; staff screens are split out so customers never download them.
const Services = lazy(() => import('./pages/Services'));
const About = lazy(() => import('./pages/About'));
const Book = lazy(() => import('./pages/Book'));
const Track = lazy(() => import('./pages/Track'));
const TrackDetail = lazy(() => import('./pages/TrackDetail'));
const Account = lazy(() => import('./pages/Account'));
const Quote = lazy(() => import('./pages/Enquiry').then((m) => ({ default: m.Quote })));
const Contact = lazy(() => import('./pages/Enquiry').then((m) => ({ default: m.Contact })));
const Warranty = lazy(() => import('./pages/Info').then((m) => ({ default: m.Warranty })));
const Faqs = lazy(() => import('./pages/Info').then((m) => ({ default: m.Faqs })));
const NotFound = lazy(() => import('./pages/Info').then((m) => ({ default: m.NotFound })));

const Login = lazy(() => import('./pages/staff/Login'));
const StaffLayout = lazy(() => import('./pages/staff/StaffLayout'));
const Dashboard = lazy(() => import('./pages/staff/Dashboard'));
const Jobs = lazy(() => import('./pages/staff/Jobs'));
const JobCard = lazy(() => import('./pages/staff/JobCard'));
const Enquiries = lazy(() => import('./pages/staff/Admin').then((m) => ({ default: m.Enquiries })));
const Claims = lazy(() => import('./pages/staff/Admin').then((m) => ({ default: m.Claims })));
const Users = lazy(() => import('./pages/staff/Admin').then((m) => ({ default: m.Users })));
const SettingsPage = lazy(() => import('./pages/staff/Settings'));
const WebsitePhotos = lazy(() => import('./pages/staff/WebsitePhotos'));
const Audit = lazy(() => import('./pages/staff/Admin').then((m) => ({ default: m.Audit })));

const s = (el: React.ReactNode) => <Suspense fallback={<PageSkeleton />}>{el}</Suspense>;

const router = createBrowserRouter([
  {
    element: <SiteLayout />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/services', element: s(<Services />) },
      { path: '/about', element: s(<About />) },
      { path: '/book', element: s(<Book />) },
      { path: '/track', element: s(<Track />) },
      { path: '/track/:repairId', element: s(<TrackDetail />) },
      { path: '/quote', element: s(<Quote />) },
      { path: '/account', element: s(<Account />) },
      { path: '/warranty', element: s(<Warranty />) },
      { path: '/faqs', element: s(<Faqs />) },
      { path: '/contact', element: s(<Contact />) },
      { path: '*', element: s(<NotFound />) },
    ],
  },
  { path: '/staff/login', element: s(<Login />) },
  {
    path: '/staff',
    element: s(<RequireStaff><StaffLayout /></RequireStaff>),
    children: [
      { index: true, element: s(<Dashboard />) },
      { path: 'jobs', element: s(<Jobs />) },
      { path: 'jobs/:repairId', element: s(<JobCard />) },
      { path: 'enquiries', element: s(<RequireStaff roles={['ADMIN', 'ADVISOR']}><Enquiries /></RequireStaff>) },
      { path: 'warranty', element: s(<RequireStaff roles={['ADMIN', 'ADVISOR']}><Claims /></RequireStaff>) },
      { path: 'users', element: s(<RequireStaff roles={['ADMIN']}><Users /></RequireStaff>) },
      { path: 'settings', element: s(<RequireStaff roles={['ADMIN']}><SettingsPage /></RequireStaff>) },
      { path: 'photos', element: s(<RequireStaff roles={['ADMIN']}><WebsitePhotos /></RequireStaff>) },
      { path: 'audit', element: s(<RequireStaff roles={['ADMIN']}><Audit /></RequireStaff>) },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
