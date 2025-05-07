export function formatTime(timeString: string): string {
    // Assumes timeString is in 'HH:MM:SS' format
    // Returns time in '12:00 AM/PM' format
    if (!timeString) return '';
    
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const amPm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
    
    return `${formattedHour}:${minutes} ${amPm}`;
  }