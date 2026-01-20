"use client";

import { ReactNode, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
  Button,
  Dropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Avatar,
} from "@heroui/react";
import {
  Building2,
  Users,
  LayoutDashboard,
  LogOut,
  User,
  Settings,
  Menu,
  Warehouse,
  FileCheck,
  UserCog,
} from "lucide-react";

const navItems = [
  { name: "首页", href: "/", icon: LayoutDashboard },
  { name: "粮库管理", href: "/depots", icon: Building2 },
  { name: "仓房管理", href: "/granaries", icon: Warehouse },
];

const adminItems = [
  { name: "用户列表", href: "/users/list", icon: UserCog },
  { name: "用户审批", href: "/users/approvals", icon: FileCheck },
];

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = session?.user?.role === 1;

  const userInitials = session?.user?.fullName 
    ? session.user.fullName.charAt(0).toUpperCase()
    : session?.user?.username?.charAt(0).toUpperCase() || "U";

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar
        maxWidth="full"
        className="bg-white border-b border-gray-200"
      >
        <NavbarContent>
          <Button
            variant="light"
            isIconOnly
            className="sm:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <Button
            variant="light"
            isIconOnly
            className="hidden sm:flex"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          >
            <Menu className="w-5 h-5" />
          </Button>
          <NavbarBrand>
            <Link href="/" className="font-bold text-xl text-primary">粮情管理系统</Link>
          </NavbarBrand>
        </NavbarContent>

        <NavbarContent justify="end" className="gap-4">
          <NavbarItem>
            <Dropdown placement="bottom-end">
              <DropdownTrigger>
                <Avatar
                  isBordered
                  as="button"
                  className="transition-transform"
                  color="primary"
                  name={session?.user?.fullName || session?.user?.username}
                  size="sm"
                  fallback={
                    <span className="text-primary font-semibold">
                      {userInitials}
                    </span>
                  }
                />
              </DropdownTrigger>
              <DropdownMenu aria-label="Profile Actions" variant="flat">
                <DropdownItem
                  key="profile"
                  className="h-14 gap-2"
                  startContent={<User className="w-4 h-4" />}
                >
                  <p className="font-semibold">
                    {session?.user?.fullName || session?.user?.username}
                  </p>
                  <p className="text-tiny text-default-500">
                    {session?.user?.email || session?.user?.username}
                  </p>
                </DropdownItem>
                <DropdownItem
                  key="settings"
                  startContent={<Settings className="w-4 h-4" />}
                >
                  设置
                </DropdownItem>
                <DropdownItem
                  key="logout"
                  color="danger"
                  startContent={<LogOut className="w-4 h-4" />}
                  onClick={() => signOut({ callbackUrl: "/login" })}
                >
                  退出登录
                </DropdownItem>
              </DropdownMenu>
            </Dropdown>
          </NavbarItem>
        </NavbarContent>
      </Navbar>

      <div className="flex flex-1 relative">
        {/* Mobile Sidebar Overlay */}
        {isMobileMenuOpen && (
          <div 
            className="fixed inset-0 z-40 bg-black/50 sm:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 sm:hidden ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <span className="font-bold text-xl text-primary">菜单</span>
            <Button
              variant="light"
              isIconOnly
              size="sm"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <Menu className="w-5 h-5" />
            </Button>
          </div>
          <nav className="p-4 space-y-2 overflow-y-auto h-[calc(100%-65px)]">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase px-3">
                    管理
                  </p>
                </div>
                {adminItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </aside>

        {/* Desktop Sidebar */}
        <aside
          className={`bg-white border-r border-gray-200 transition-all duration-300 ${
            isSidebarOpen ? "w-64" : "w-16"
          } hidden sm:block`}
        >
          <nav className="p-4 space-y-2">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                    isSidebarOpen ? "" : "justify-center"
                  } ${
                    isActive
                      ? "bg-primary text-white"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {isSidebarOpen && <span>{item.name}</span>}
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <div className="pt-4 pb-2">
                  {isSidebarOpen && (
                    <p className="text-xs font-semibold text-gray-400 uppercase px-3">
                      管理
                    </p>
                  )}
                </div>
                {adminItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isSidebarOpen ? "" : "justify-center"
                      } ${
                        isActive
                          ? "bg-primary text-white"
                          : "text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      <item.icon className="w-5 h-5 flex-shrink-0" />
                      {isSidebarOpen && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </>
            )}
          </nav>
        </aside>

        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
