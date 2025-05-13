'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  CalendarIcon, FileIcon, Building, 
  CalendarCheck, CheckSquare, HelpCircle, 
  Users, MapPin, Wallet, ChevronLeft, ChevronRight, Menu
} from 'lucide-react';
import { Button } from './ui/button';
import { Sheet, SheetContent, SheetTrigger } from './ui/sheet';

interface SidebarNavProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  className?: string;
}

export function SidebarNav({ activeTab, setActiveTab, className }: SidebarNavProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const navItems = [
    { id: 'overview', label: 'Overview', icon: <CalendarIcon className="h-5 w-5" /> },
    { id: 'guests', label: 'Guests', icon: <Users className="h-5 w-5" /> },
    { id: 'travel', label: 'Travel', icon: <FileIcon className="h-5 w-5" /> },
    { id: 'lodging', label: 'Lodging', icon: <Building className="h-5 w-5" /> },
    { id: 'itinerary', label: 'Itinerary', icon: <CalendarCheck className="h-5 w-5" /> },
    { id: 'expenses', label: 'Expenses', icon: <Wallet className="h-5 w-5" /> },
    { id: 'polls', label: 'Polls', icon: <HelpCircle className="h-5 w-5" /> },
    { id: 'todos', label: 'To-dos', icon: <CheckSquare className="h-5 w-5" /> },
    { id: 'map', label: 'Map', icon: <MapPin className="h-5 w-5" /> },
  ];

  // The desktop sidebar (collapsible)
  const DesktopSidebar = (
    <div 
      className={cn(
        "hidden md:flex flex-col h-[calc(100vh-3.5rem)] sticky top-14 border-r transition-all", 
        isCollapsed ? "w-[60px]" : "w-[240px]",
        className
      )}
    >
      <div className="flex-1 py-4 overflow-auto">
        <div className="space-y-1 px-2">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant={activeTab === item.id ? "secondary" : "ghost"}
              className={cn(
                "w-full justify-start py-2 px-3 mb-1",
                isCollapsed && "justify-center px-2"
              )}
              onClick={() => setActiveTab(item.id)}
            >
              {item.icon}
              {!isCollapsed && <span className="ml-2">{item.label}</span>}
            </Button>
          ))}
        </div>
      </div>
      <div className="p-2 border-t">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );

  // The mobile sidebar (slide-in drawer)
  const MobileSidebar = (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-[240px] p-0">
        <div className="flex flex-col h-full">
          <div className="flex-1 py-4 overflow-auto">
            <div className="space-y-1 px-2">
              {navItems.map((item) => (
                <Button
                  key={item.id}
                  variant={activeTab === item.id ? "secondary" : "ghost"}
                  className="w-full justify-start py-2 px-3 mb-1"
                  onClick={() => {
                    setActiveTab(item.id);
                    (document.querySelector('[data-radix-collection-item]') as HTMLElement)?.click(); // Close sheet after selection
                  }}
                >
                  {item.icon}
                  <span className="ml-2">{item.label}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <>
      {MobileSidebar}
      {DesktopSidebar}
    </>
  );
}