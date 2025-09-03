// controllers/announcementController.js
const announcementService = require('../services/announcementService');

class AnnouncementController {
  // Get active announcements for public use
  async getActiveAnnouncements(req, res) {
    try {
      const announcements = await announcementService.getActiveAnnouncements();
      
      res.status(200).json({
        success: true,
        data: announcements,
        message: 'Active announcements fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get all announcements (Admin only)
  async getAllAnnouncements(req, res) {
    try {
      const announcements = await announcementService.getAllAnnouncements();
      
      res.status(200).json({
        success: true,
        data: announcements,
        message: 'All announcements fetched successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Create new announcement (Admin only)
  async createAnnouncement(req, res) {
    try {
      const { title, message, isActive, priority } = req.body;
      const createdBy = req.user.id; // Assuming you have user info in req.user from auth middleware
      
      if (!title || !message) {
        return res.status(400).json({
          success: false,
          message: 'Title and message are required'
        });
      }
      
      const announcementData = {
        title,
        message,
        isActive,
        priority,
        createdBy
      };
      
      const announcement = await announcementService.createAnnouncement(announcementData);
      
      res.status(201).json({
        success: true,
        data: announcement,
        message: 'Announcement created successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update announcement (Admin only)
  async updateAnnouncement(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const announcement = await announcementService.updateAnnouncement(id, updateData);
      
      res.status(200).json({
        success: true,
        data: announcement,
        message: 'Announcement updated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete announcement (Admin only)
  async deleteAnnouncement(req, res) {
    try {
      const { id } = req.params;
      
      const result = await announcementService.deleteAnnouncement(id);
      
      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get single announcement
  async getAnnouncementById(req, res) {
    try {
      const { id } = req.params;
      
      const announcement = await announcementService.getAnnouncementById(id);
      
      res.status(200).json({
        success: true,
        data: announcement,
        message: 'Announcement fetched successfully'
      });
    } catch (error) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Toggle announcement status (Admin only)
  async toggleAnnouncementStatus(req, res) {
    try {
      const { id } = req.params;
      
      const announcement = await announcementService.toggleAnnouncementStatus(id);
      
      res.status(200).json({
        success: true,
        data: announcement,
        message: `Announcement ${announcement.isActive ? 'activated' : 'deactivated'} successfully`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new AnnouncementController();