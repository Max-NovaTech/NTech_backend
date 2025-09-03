const prisma = require("../config/db");

class AnnouncementService {
  // Get all active announcements (for public display)
  async getActiveAnnouncements() {
    try {
      const announcements = await prisma.announcement.findMany({
        where: {
          isActive: true
        },
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      return announcements;
    } catch (error) {
      throw new Error(`Failed to fetch active announcements: ${error.message}`);
    }
  }

  // Get all announcements (for admin dashboard)
  async getAllAnnouncements() {
    try {
      const announcements = await prisma.announcement.findMany({
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });
      return announcements;
    } catch (error) {
      throw new Error(`Failed to fetch announcements: ${error.message}`);
    }
  }

  // Create new announcement
  async createAnnouncement(data) {
    try {
      const { title, message, priority = 1, createdBy } = data;

      // Deactivate all previous announcements
      await prisma.announcement.updateMany({
        where: { isActive: true },
        data: { isActive: false }
      });

      // Create the new announcement as active
      const announcement = await prisma.announcement.create({
        data: {
          title,
          message,
          isActive: true, // Always set new as active
          priority,
          createdBy
        }
      });

      return announcement;
    } catch (error) {
      throw new Error(`Failed to create announcement: ${error.message}`);
    }
  }

  // Update announcement
  async updateAnnouncement(id, data) {
    try {
      const { title, message, isActive, priority } = data;

      
      const announcement = await prisma.announcement.update({
        where: { id },
        data: {
          ...(title && { title }),
          ...(message && { message }),
          ...(isActive !== undefined && { isActive }),
          ...(priority !== undefined && { priority })
        }
      });
      
      return announcement;
    } catch (error) {
      throw new Error(`Failed to update announcement: ${error.message}`);
    }
  }

  // Delete announcement
  async deleteAnnouncement(id) {
    try {
      await prisma.announcement.delete({
        where: { id }
      });
      return { message: 'Announcement deleted successfully' };
    } catch (error) {
      throw new Error(`Failed to delete announcement: ${error.message}`);
    }
  }

  // Get single announcement
  async getAnnouncementById(id) {
    try {
      const announcement = await prisma.announcement.findUnique({
        where: { id }
      });
      
      if (!announcement) {
        throw new Error('Announcement not found');
      }
      
      return announcement;
    } catch (error) {
      throw new Error(`Failed to fetch announcement: ${error.message}`);
    }
  }

  // Toggle announcement status
  async toggleAnnouncementStatus(id) {
    try {
      const announcement = await prisma.announcement.findUnique({
        where: { id }
      });
      
      if (!announcement) {
        throw new Error('Announcement not found');
      }
      
      const updated = await prisma.announcement.update({
        where: { id },
        data: {
          isActive: !announcement.isActive
        }
      });
      
      return updated;
    } catch (error) {
      throw new Error(`Failed to toggle announcement status: ${error.message}`);
    }
  }
}

module.exports = new AnnouncementService();