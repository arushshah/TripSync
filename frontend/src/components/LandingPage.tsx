'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/AuthProvider';
import { Header } from './Header';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './ui/card';
import { ArrowRight, CheckCircle2, PhoneCall, Calendar, MapPin, Banknote, CheckSquare, Bell, VoteIcon } from 'lucide-react';

const LandingPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  React.useEffect(() => {
    if (!loading && user) {
      router.push('/dashboard');
    }
  }, [loading, user, router]);

  return (
    <div className="flex min-h-screen flex-col">
      <Header showAuthButtons={false} />

      <main className="flex-grow">
        <section className="bg-gradient-to-b from-background to-muted/30 py-24 md:py-32">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              Simplify Group Travel Planning
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl">
              TripSync helps you plan trips together by consolidating RSVPs, documents, 
              itineraries, and expenses in one place.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/login">
                  Start Planning
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="#features" className="group">
                  Learn More
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="container mx-auto px-4 py-24">
          <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">Features</h2>
          
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard 
              title="Phone + OTP Login" 
              description="Simple authentication with just your phone number. No emails or passwords required." 
              icon={<PhoneCall />}
            />
            <FeatureCard 
              title="RSVP System" 
              description="Collect responses with 'going,' 'maybe,' and 'can't go' options. Set guest limits and manage waitlists." 
              icon={<CheckCircle2 />}
            />
            <FeatureCard 
              title="Trip Documents" 
              description="Upload and share travel and accommodation documents in one place." 
              icon={<CheckCircle2 />}
            />
            <FeatureCard 
              title="Itinerary Planning" 
              description="Create and edit day-by-day trip plans automatically generated based on trip dates." 
              icon={<Calendar />}
            />
            <FeatureCard 
              title="Trip Map" 
              description="Mark and categorize locations on a shared map for food, activities, and more." 
              icon={<MapPin />}
            />
            <FeatureCard 
              title="Expense Tracking" 
              description="Track shared expenses with itemized ledger and automatic balance calculations." 
              icon={<Banknote />}
            />
            <FeatureCard 
              title="To-Do Lists" 
              description="Create and delegate action items for trip planning and preparation." 
              icon={<CheckSquare />}
            />
            <FeatureCard 
              title="Real-time Updates" 
              description="Stay in the loop with activity feeds showing document uploads, RSVP changes, and more." 
              icon={<Bell />}
            />
            <FeatureCard 
              title="Social Voting" 
              description="Create polls to decide on dates, places, or activities democratically." 
              icon={<VoteIcon />}
            />
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/40 py-6 px-4">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} TripSync. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const FeatureCard = ({ title, description, icon }: FeatureCardProps) => {
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader>
        <div className="rounded-full bg-primary/10 p-2 w-10 h-10 flex items-center justify-center text-primary mb-4">
          {React.cloneElement(icon as React.ReactElement, { className: 'h-5 w-5' })}
        </div>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base">{description}</CardDescription>
      </CardContent>
    </Card>
  );
};

export default LandingPage;