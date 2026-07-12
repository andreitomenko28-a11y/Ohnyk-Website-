import Sidebar from './Sidebar.jsx';
import BottomNav from './BottomNav.jsx';

// App shell for authenticated screens.
// - Mobile: single column + floating BottomNav (unchanged).
// - Desktop (lg+): left Sidebar rail + a wide, centered content column.
export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen lg:flex">
      <Sidebar />
      <main className="mx-auto w-full max-w-[440px] pb-24 lg:mx-0 lg:max-w-none lg:flex-1 lg:pb-10">
        <div className="lg:mx-auto lg:max-w-[1120px] lg:px-8 lg:pt-4">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
