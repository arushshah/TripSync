'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from './ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { MapPin, Plus, X, Loader2, Search } from 'lucide-react';
import { api } from '../lib/api';
import { useToast } from '../hooks/use-toast';
import { useAuth } from '../lib/auth/AuthProvider';

// Categories with associated colors - Now just a color palette to use for custom categories
const CATEGORY_COLORS = [
  '#FF5733', // Orange-red
  '#33A1FD', // Blue
  '#33FF57', // Green
  '#D433FF', // Purple
  '#FFD733', // Yellow
  '#808080', // Gray
];

// Helper function to get a consistent color for a category name
function getCategoryColor(categoryName: string): string {
  // Hash the category name to get a consistent index
  const hash = categoryName.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  
  // Use the hash to pick a color from our palette
  const index = Math.abs(hash) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[index];
}

// Map container style
const mapContainerStyle = {
  width: '100%',
  height: '500px',
  borderRadius: '0.5rem',
};

// Libraries needed for Google Maps
const libraries: ["places" | "drawing" | "geometry" | "visualization"] = ["places"];

interface MapTabProps {
  tripId: string;
  userRole: string;
}

interface MarkerState {
  id: string;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  address: string;
  description: string;
  website: string;
  phone: string;
  creator_id: string;
}

// Form state for new marker
interface NewMarkerState {
  name: string;
  category: string;
  address: string;
  description: string;
  website: string;
  phone: string;
}

// Search box component with Places Autocomplete
  const SearchBox = ({ onPlaceSelected }: { onPlaceSelected: (place: google.maps.places.PlaceResult) => void }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  
  // Initialize autocomplete when the component mounts or the input ref changes
  useEffect(() => {
    if (!searchInputRef.current || !window.google?.maps?.places) return;
    
    // Create new autocomplete instance
    const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current);
    autocompleteRef.current = autocomplete;
    
    // Add listener for place_changed event
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        onPlaceSelected(place);
        setSearchQuery(''); // Clear search after selection
      }
    });
    
    // Clean up listeners when component unmounts
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [searchInputRef, onPlaceSelected]);

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <Input
        ref={searchInputRef}
        type="text"
        placeholder="Search for a place..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="pl-10 w-full"
      />
    </div>
  );
};

export function MapTab({ tripId, userRole }: MapTabProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries,
  });

  const { user } = useAuth(); // Get the current user
  const [markers, setMarkers] = useState<MarkerState[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedMarker, setSelectedMarker] = useState<MarkerState | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [center, setCenter] = useState({ lat: 40.712776, lng: -74.005974 }); // Default to NYC
  const [zoom, setZoom] = useState(12);
  const [mapClickLocation, setMapClickLocation] = useState<{lat: number, lng: number} | null>(null);
  const [editingMarker, setEditingMarker] = useState<MarkerState | null>(null);
  
  // Add state to track expanded categories
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  
  // Form state for adding new marker
  const [newMarker, setNewMarker] = useState({
    name: '',
    category: '',
    address: '',
    description: '',
    website: '',
    phone: '',
  });

  const { toast } = useToast();
  const mapRef = useRef<google.maps.Map | null>(null);

  // Load markers on component mount
  useEffect(() => {
    fetchMarkers();
  }, [tripId]);

  // Initialize all categories as expanded when markers change
  useEffect(() => {
    if (markers.length > 0) {
      const categories = Array.from(new Set(markers.map(m => m.category)));
      const initialExpandedState: Record<string, boolean> = {};
      categories.forEach(category => {
        initialExpandedState[category] = true;
      });
      setExpandedCategories(initialExpandedState);
    }
  }, [markers]);
  
  // Toggle category expansion
  const toggleCategoryExpansion = (category: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  // Handle place selected from search box
  const handlePlaceSelected = (place: google.maps.places.PlaceResult) => {
    if (place.geometry?.location) {
      // Center map on selected location
      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      setCenter({ lat, lng });
      setZoom(16);
      
      // Set up to add a new marker
      setMapClickLocation({ lat, lng });
      
      // Pre-fill the form with place information
      setNewMarker({
        name: place.name || '',
        category: '',  // Category is optional now
        address: place.formatted_address || '',
        description: '',
        website: place.website || '',
        phone: place.formatted_phone_number || '',
      });
      
      // Open dialog
      setShowAddDialog(true);
    }
  };

  // Fetch markers from API
  const fetchMarkers = async () => {
    try {
      setLoading(true);
      const response = await api.getMapLocations(tripId);
      
      // Check if response exists and has data
      if (response && Array.isArray(response)) {
        // Transform API response to match MarkerState structure
        const formattedMarkers: MarkerState[] = response.map((markerData: any) => ({
          id: markerData.id,
          trip_id: markerData.trip_id,
          creator_id: markerData.creator_id,
          name: markerData.name || 'Unnamed Location',
          category: markerData.category || 'Unassigned',
          latitude: parseFloat(markerData.latitude),
          longitude: parseFloat(markerData.longitude),
          address: markerData.address || '',
          description: markerData.description || '',
          website: markerData.website || '',
          phone: markerData.phone || '',
          created_at: markerData.created_at,
          updated_at: markerData.updated_at
        }));
        
        console.log('Markers loaded:', formattedMarkers);
        setMarkers(formattedMarkers);
        
        // Fit map to show all markers
        if (formattedMarkers.length > 0 && isLoaded) {
          fitMapToMarkers(formattedMarkers);
        }
      } else {
        console.error('Invalid marker data format received:', response);
        setMarkers([]);
      }
    } catch (error) {
      console.error('Error fetching map markers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load map markers',
        variant: 'destructive',
      });
      setMarkers([]);
    } finally {
      setLoading(false);
    }
  };

  // Fit map to show all markers
  const fitMapToMarkers = useCallback((markersToFit: MarkerState[]) => {
    if (markersToFit.length === 0) return;
    
    // Create bounds object
    const bounds = new google.maps.LatLngBounds();
    
    // Add all marker positions to bounds
    markersToFit.forEach((marker) => {
      bounds.extend({ lat: marker.latitude, lng: marker.longitude });
    });
    
    // Update map center and zoom based on bounds
    if (mapRef.current) {
      mapRef.current.fitBounds(bounds);
      
      // Add slight padding if there's only one marker
      if (markersToFit.length === 1) {
        setZoom(15); // Set a default zoom for single marker
      }
    } else {
      // If map isn't loaded yet, just set center to first marker
      setCenter({
        lat: markersToFit[0].latitude,
        lng: markersToFit[0].longitude
      });
      setZoom(12);
    }
  }, []);

  // Filter markers by category
  useEffect(() => {
    if (tripId) {
      fetchMarkers();
    }
  }, [selectedCategory, tripId]);

  // Add marker
  const addMarker = async () => {
    try {
      if (!mapClickLocation) return;
      
      const markerData = {
        name: newMarker.name,
        // Category is optional now
        ...(newMarker.category && { category: newMarker.category }),
        latitude: mapClickLocation.lat,
        longitude: mapClickLocation.lng,
        address: newMarker.address,
        description: newMarker.description,
        website: newMarker.website,
        phone: newMarker.phone
      };

      const response = await api.addMapLocation(tripId, markerData);
      
      setMarkers(prev => [...prev, response]);
      resetForm();
      setShowAddDialog(false);
      
      toast({
        title: 'Success',
        description: 'Location added successfully',
      });
    } catch (error) {
      console.error('Error adding marker:', error);
      toast({
        title: 'Error',
        description: 'Failed to add location',
        variant: 'destructive',
      });
    }
  };

  // Delete marker
  const deleteMarker = async (markerId: string) => {
    try {
      await api.deleteMapLocation(tripId, markerId);
      setMarkers(prev => prev.filter(marker => marker.id !== markerId));
      setSelectedMarker(null);
      
      toast({
        title: 'Success',
        description: 'Location removed successfully',
      });
    } catch (error) {
      console.error('Error deleting marker:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove location',
        variant: 'destructive',
      });
    }
  };

  // Handle map click
  const handleMapClick = (event: google.maps.MapMouseEvent) => {
    if (!event.latLng) return;
    
    const lat = event.latLng.lat();
    const lng = event.latLng.lng();
    
    setMapClickLocation({ lat, lng });
    setShowAddDialog(true);
  };

  // Reset form fields
  const resetForm = () => {
    setNewMarker({
      name: '',
      category: '',
      address: '',
      description: '',
      website: '',
      phone: '',
    });
    setMapClickLocation(null);
  };

  // Get marker icon by category
  const getMarkerIcon = (category: string) => {
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: getCategoryColor(category),
      fillOpacity: 1,
      strokeWeight: 1,
      strokeColor: '#FFFFFF',
      scale: 8
    };
  };

  // Group markers by category
  const markersByCategory = markers.reduce<Record<string, MarkerState[]>>((acc, marker) => {
    if (!acc[marker.category]) {
      acc[marker.category] = [];
    }
    acc[marker.category].push(marker);
    return acc;
  }, {});

  // Handler for when map is loaded
  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
  }, []);

  // Open edit dialog
  const openEditDialog = (marker: MarkerState) => {
    setEditingMarker(marker);
    setNewMarker({
      name: marker.name,
      category: marker.category,
      address: marker.address,
      description: marker.description,
      website: marker.website,
      phone: marker.phone
    });
    setShowEditDialog(true);
  };
  
  // Edit marker
  const editMarker = async () => {
    if (!editingMarker) return;
    
    try {
      const markerData = {
        name: newMarker.name,
        // Category is optional now
        ...(newMarker.category ? { category: newMarker.category } : {}),
        address: newMarker.address,
        description: newMarker.description,
        website: newMarker.website,
        phone: newMarker.phone
      };
      
      const response = await api.updateMapLocation(tripId, editingMarker.id, markerData);
      
      setMarkers(prev => 
        prev.map(m => m.id === editingMarker.id ? {...m, ...markerData} : m)
      );
      
      // If this marker is currently selected, update selected marker
      if (selectedMarker?.id === editingMarker.id) {
        setSelectedMarker({...selectedMarker, ...markerData});
      }
      
      resetForm();
      setShowEditDialog(false);
      setEditingMarker(null);
      
      toast({
        title: 'Success',
        description: 'Location updated successfully',
      });
    } catch (error) {
      console.error('Error updating marker:', error);
      toast({
        title: 'Error',
        description: 'Failed to update location',
        variant: 'destructive',
      });
    }
  };
  
  // Handle info window button clicks
  useEffect(() => {
    const handleInfoWindowButtonClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      if (target.classList.contains('delete-marker-btn')) {
        const markerId = target.getAttribute('data-marker-id');
        if (markerId) {
          deleteMarker(markerId);
        }
      }
      
      if (target.classList.contains('edit-marker-btn')) {
        const markerId = target.getAttribute('data-marker-id');
        if (markerId) {
          const markerToEdit = markers.find(m => m.id === markerId);
          if (markerToEdit) {
            openEditDialog(markerToEdit);
          }
        }
      }
    };
    
    document.addEventListener('click', handleInfoWindowButtonClick);
    return () => {
      document.removeEventListener('click', handleInfoWindowButtonClick);
    };
  }, [markers]);

  if (loadError) {
    return <div>Error loading maps. Please check your API key.</div>;
  }

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading map...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-2 sm:space-y-0 mb-4">
        <h2 className="text-2xl font-bold">Map</h2>
        
        <div className="flex items-center space-x-2">
          <Select
            value={selectedCategory || 'all'}
            onValueChange={(value) => setSelectedCategory(value === 'all' ? null : value)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.keys(markersByCategory).map(category => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Search Box */}
      <div className="mb-4">
        {isLoaded && <SearchBox onPlaceSelected={handlePlaceSelected} />}
      </div>

      {/* Google Map */}
      <div className="border rounded-lg overflow-hidden">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={center}
          zoom={zoom}
          onClick={handleMapClick}
          onLoad={onMapLoad}
          options={{
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
          }}
        >
          {/* Render markers */}
          {markers.map(marker => (
            <Marker
              key={marker.id}
              position={{
                lat: marker.latitude,
                lng: marker.longitude
              }}
              onClick={() => setSelectedMarker(marker)}
              icon={getMarkerIcon(marker.category)}
            />
          ))}
          
          {/* Info window for selected marker */}
          {selectedMarker && (
            <InfoWindow
              position={{
                lat: selectedMarker.latitude,
                lng: selectedMarker.longitude
              }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-2 max-w-[250px]">
                <h3 className="font-bold mb-1 text-gray-900">{selectedMarker.name}</h3>
                {selectedMarker.address && (
                  <p className="text-sm text-gray-600 mb-1">{selectedMarker.address}</p>
                )}
                {selectedMarker.description && (
                  <p className="text-sm mb-2 text-gray-700">{selectedMarker.description}</p>
                )}
                <div className="flex items-center gap-1 mb-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getCategoryColor(selectedMarker.category) }}
                  ></div>
                  <span className="text-xs text-gray-500 capitalize">
                    {selectedMarker.category}
                  </span>
                </div>
                {selectedMarker.website && (
                  <p className="text-xs mb-1">
                    <a href={selectedMarker.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Visit Website
                    </a>
                  </p>
                )}
                {selectedMarker.phone && (
                  <p className="text-xs mb-2">
                    <a href={`tel:${selectedMarker.phone}`} className="text-blue-600 hover:underline">
                      {selectedMarker.phone}
                    </a>
                  </p>
                )}
                {(userRole === 'planner' || selectedMarker.creator_id === user?.uid) && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => openEditDialog(selectedMarker)}
                      className="w-full mt-1 text-xs"
                    >
                      Edit Marker
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive" 
                      onClick={() => deleteMarker(selectedMarker.id)}
                      className="w-full mt-1 text-xs"
                    >
                      Remove Marker
                    </Button>
                  </>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      {/* Add marker dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Location</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newMarker.name}
                onChange={(e) => setNewMarker({ ...newMarker, name: e.target.value })}
                placeholder="Location name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="category">Category (optional)</Label>
              <Input
                id="category"
                value={newMarker.category}
                onChange={(e) => setNewMarker({ ...newMarker, category: e.target.value })}
                placeholder="Category (leave blank for 'Unassigned')"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={newMarker.address}
                onChange={(e) => setNewMarker({ ...newMarker, address: e.target.value })}
                placeholder="Address (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={newMarker.description}
                onChange={(e) => setNewMarker({ ...newMarker, description: e.target.value })}
                placeholder="Description (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={newMarker.website}
                onChange={(e) => setNewMarker({ ...newMarker, website: e.target.value })}
                placeholder="Website URL (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={newMarker.phone}
                onChange={(e) => setNewMarker({ ...newMarker, phone: e.target.value })}
                placeholder="Phone number (optional)"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setShowAddDialog(false);
            }}>Cancel</Button>
            <Button onClick={addMarker} disabled={!newMarker.name}>Add Location</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Location Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Location</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={newMarker.name}
                onChange={(e) => setNewMarker({ ...newMarker, name: e.target.value })}
                placeholder="Location name"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category (optional)</Label>
              <Input
                id="edit-category"
                value={newMarker.category}
                onChange={(e) => setNewMarker({ ...newMarker, category: e.target.value })}
                placeholder="Category (leave blank for 'Unassigned')"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={newMarker.address}
                onChange={(e) => setNewMarker({ ...newMarker, address: e.target.value })}
                placeholder="Address (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                value={newMarker.description}
                onChange={(e) => setNewMarker({ ...newMarker, description: e.target.value })}
                placeholder="Description (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-website">Website</Label>
              <Input
                id="edit-website"
                value={newMarker.website}
                onChange={(e) => setNewMarker({ ...newMarker, website: e.target.value })}
                placeholder="Website URL (optional)"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phone">Phone</Label>
              <Input
                id="edit-phone"
                value={newMarker.phone}
                onChange={(e) => setNewMarker({ ...newMarker, phone: e.target.value })}
                placeholder="Phone number (optional)"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              resetForm();
              setShowEditDialog(false);
              setEditingMarker(null);
            }}>Cancel</Button>
            <Button onClick={editMarker} disabled={!newMarker.name}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* List of markers by category */}
      <div className="mt-8">
        <h3 className="text-xl font-semibold mb-4">Saved Locations</h3>
        
        {loading ? (
          <div className="flex justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : markers.length === 0 ? (
          <div className="text-center p-8 bg-muted rounded-lg">
            <MapPin className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
            <h3 className="mt-2 text-lg font-medium">No locations saved yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Click on the map to add your first location
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(markersByCategory).map(([category, categoryMarkers]) => {
              // The hook was removed from here - now we're just accessing the state
              const isExpanded = expandedCategories[category] || false;
              
              return (
                <Card key={category} className="overflow-hidden">
                  <CardHeader 
                    className="bg-muted/50 py-3 cursor-pointer"
                    onClick={() => toggleCategoryExpansion(category)}
                  >
                    <CardTitle className="flex items-center justify-between text-lg">
                      <div className="flex items-center">
                        <div
                          className="w-4 h-4 rounded-full mr-2"
                          style={{ backgroundColor: getCategoryColor(category) }}
                        ></div>
                        <span>
                          {category}
                          <span className="ml-2 text-sm font-normal text-muted-foreground">
                            ({categoryMarkers.length} {categoryMarkers.length === 1 ? 'place' : 'places'})
                          </span>
                        </span>
                      </div>
                      <div>
                        {isExpanded ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-chevron-up"><polyline points="18 15 12 9 6 15"></polyline></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-chevron-down"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent className="divide-y">
                      {categoryMarkers.map(marker => (
                        <div 
                          key={marker.id} 
                          className="py-3 first:pt-4 last:pb-4 cursor-pointer transition-colors"
                          style={{
                            "--marker-color": getCategoryColor(category),
                          } as React.CSSProperties}
                          onClick={() => {
                            setSelectedMarker(marker);
                            setCenter({lat: marker.latitude, lng: marker.longitude});
                            setZoom(16);
                          }}
                          onMouseEnter={(e) => {
                            const el = e.currentTarget;
                            // Use a lighter shade of the category color (20% opacity)
                            el.style.backgroundColor = `${getCategoryColor(category)}33`; // 33 is hex for 20% opacity
                            el.style.transform = 'scale(1.01)';
                            // Make the font size larger
                            el.querySelector('h4')?.classList.add('text-lg');
                          }}
                          onMouseLeave={(e) => {
                            const el = e.currentTarget;
                            el.style.backgroundColor = '';
                            el.style.transform = '';
                            el.querySelector('h4')?.classList.remove('text-lg');
                          }}
                        >
                          {/* Rest of the code remains the same */}
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <h4 className="font-medium">{marker.name}</h4>
                                      {marker.address && (
                                        <p className="text-sm text-muted-foreground">{marker.address}</p>
                                      )}
                                      {marker.description && (
                                        <p className="text-sm mt-1">{marker.description}</p>
                                      )}
                                      <div className="flex flex-wrap gap-2 mt-2">
                                        {marker.website && (
                                          <a
                                            href={marker.website}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            Website
                                          </a>
                                        )}
                                        {marker.phone && (
                                          <a
                                            href={`tel:${marker.phone}`}
                                            className="text-xs text-blue-600 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {marker.phone}
                                          </a>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                              </div>
                            ))}
                          </CardContent>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}
          </div>
        </div>
  );
}