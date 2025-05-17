import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Please check your .env file.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

// Storage helper functions
export const uploadFile = async (file: File, tripId: string, userId: string): Promise<string> => {
  // Create a unique file path using userId, tripId and current timestamp
  const filePath = `${tripId}/${userId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  
  // Upload to Supabase storage using anonymous access (relies on bucket policy)
  const { data, error } = await supabase.storage
    .from('tripsync-bucket')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (error) {
    console.error('Error uploading file:', error);
    throw error;
  }

  // Get public URL for the uploaded file
  const { data: { publicUrl } } = supabase.storage
    .from('tripsync-bucket')
    .getPublicUrl(filePath);

  return publicUrl;
};

// Delete file from storage
export const deleteFile = async (fileUrl: string): Promise<void> => {
  try {
    // Extract the file path from the public URL
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/tripsync-bucket\/(.+)/);
    
    if (!pathMatch || !pathMatch[1]) {
      throw new Error('Invalid file URL format');
    }
    
    const filePath = decodeURIComponent(pathMatch[1]);
    
    const { error } = await supabase.storage
      .from('tripsync-bucket')
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  } catch (err) {
    console.error('Failed to delete file from storage:', err);
    throw err;
  }
};

// Generate a temporary signed URL for viewing files with an expiration time
export const getTemporaryFileUrl = async (fileUrl: string): Promise<string> => {
  try {
    // Extract the file path from the public URL
    const urlObj = new URL(fileUrl);
    const pathMatch = urlObj.pathname.match(/\/storage\/v1\/object\/public\/tripsync-bucket\/(.+)/);
    
    if (!pathMatch || !pathMatch[1]) {
      throw new Error('Invalid file URL format');
    }
    
    const filePath = decodeURIComponent(pathMatch[1]);
    
    // Generate a signed URL that expires in 60 minutes
    const { data, error } = await supabase.storage
      .from('tripsync-bucket')
      .createSignedUrl(filePath, 60 * 60);
      
    if (error) {
      console.error('Error generating signed URL:', error);
      throw error;
    }
    
    return data.signedUrl;
  } catch (err) {
    console.error('Failed to generate temporary URL:', err);
    throw err;
  }
};

// List all available trip cover image paths from the 'trip-covers/' folder (private bucket)
export const listTripCoverImagePaths = async (): Promise<string[]> => {
  const { data, error } = await supabase.storage
    .from('tripsync-bucket')
    .list('trip-covers', { limit: 100, offset: 0 });

  if (error) {
    console.error('Error listing trip cover images:', error);
    return [];
  }

  if (!data) return [];

  // Return file paths (e.g., 'trip-covers/barcelona.jpg')
  return data
    .filter((item) => item.name.match(/\.(jpg|jpeg|png|webp)$/i))
    .map((item) => `trip-covers/${item.name}`);
};

// Generate a signed URL for a given file path in the bucket
export const getTripCoverSignedUrl = async (filePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('tripsync-bucket')
    .createSignedUrl(filePath, 60 * 60); // 1 hour expiry

  if (error) {
    console.error('Error generating signed URL:', error);
    return null;
  }
  return data.signedUrl;
};