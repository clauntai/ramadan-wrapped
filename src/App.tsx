import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { DonationProvider } from './context/DonationContext';
import { LandingPage } from './pages/LandingPage';
import { RecapPage } from './pages/RecapPage';

const router = createBrowserRouter([
  { path: '/', element: <LandingPage /> },
  { path: '/recap', element: <RecapPage /> },
]);

export default function App() {
  return (
    <DonationProvider>
      <RouterProvider router={router} />
    </DonationProvider>
  );
}
