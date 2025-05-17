'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../lib/auth/AuthProvider';
import { ThemeToggle } from './theme/ThemeToggle';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Avatar, AvatarFallback } from './ui/avatar';
import { LogOut, Menu, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

type HeaderProps = {
  showAuthButtons?: boolean;
};

export function Header({ showAuthButtons = true }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user) return 'GU'; // Guest User
    
    if (user.displayName) {
      const nameParts = user.displayName.split(' ');
      if (nameParts.length >= 2) {
        return `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase();
      }
      return user.displayName[0].toUpperCase();
    }
    
    if (user.phoneNumber) {
      return 'U'; // Just use "U" for User when only phone number is available
    }
    
    return 'U';
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center">
        <div className="flex flex-1 items-center justify-between">
          {/* Logo for desktop */}
          <div className="hidden md:flex items-center">
            <button
              onClick={() => router.push(user ? '/dashboard' : '/')}
              className="block leading-none"
              style={{ padding: 10, border: 'none', background: 'none' }}
            >
              <Image
                src="/images/tripsync-logo.png"
                alt="TripSync Logo"
                width={240}
                height={60}
                className="h-[40px] w-auto object-contain"
                priority
              />
            </button>
          </div>

          {/* Logo for mobile */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => router.push(user ? '/dashboard' : '/')}
              className="block leading-none"
              style={{ padding: 10, border: 'none', background: 'none' }}
            >
              <Image
                src="/images/tripsync-logo.png"
                alt="TripSync Logo"
                width={200}
                height={50}
                className="h-[35px] w-auto object-contain"
                priority
              />
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <ThemeToggle />
            
            {showAuthButtons && user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{getUserInitials()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>
                    {user.displayName}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push('/profile')} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            
            {showAuthButtons && !user && (
              <Button onClick={() => router.push('/login')} variant="secondary">
                Sign In
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}