from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Restaurant(models.Model):
    """A restaurant that might serve toast"""
    place_id = models.CharField(max_length=255, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    address = models.TextField()
    latitude = models.FloatField()
    longitude = models.FloatField()
    created_at = models.DateTimeField(default=timezone.now)
    
    # Toast availability status
    has_toast = models.BooleanField(null=True, blank=True, help_text="Does this place serve toast?")
    
    # Cached rating fields (updated via signals)
    average_rating = models.FloatField(null=True, blank=True)
    total_ratings = models.IntegerField(default=0)
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['latitude', 'longitude']),
        ]
    
    def __str__(self):
        return self.name
    
    def update_rating_cache(self):
        """Update the cached rating values"""
        ratings = self.ratings.all()
        if ratings.exists():
            self.total_ratings = ratings.count()
            self.average_rating = ratings.aggregate(
                avg_rating=models.Avg('rating')
            )['avg_rating']
        else:
            self.total_ratings = 0
            self.average_rating = None
        self.save(update_fields=['average_rating', 'total_ratings'])


class Rating(models.Model):
    """A toast rating for a restaurant"""
    restaurant = models.ForeignKey(
        Restaurant, 
        on_delete=models.CASCADE, 
        related_name='ratings'
    )
    rating = models.IntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)]
    )
    review = models.TextField()
    created_at = models.DateTimeField(default=timezone.now)
    
    class Meta:
        ordering = ['-created_at']
    
    def __str__(self):
        return f"{self.restaurant.name} - {self.rating} stars"
    
    def clean(self):
        """Validate that the review mentions toast"""
        from django.core.exceptions import ValidationError
        
        if self.review:
            toast_keywords = [
                'toast', 'bread', 'butter', 'jam', 'marmalade', 
                'french toast', 'avocado', 'sourdough', 'rye', 
                'whole wheat', 'brioche', 'challah'
            ]
            review_lower = self.review.lower()
            if not any(keyword in review_lower for keyword in toast_keywords):
                raise ValidationError(
                    'Reviews must be about toast! Please mention the toast in your review.'
                )
        super().clean()
    
    def save(self, *args, **kwargs):
        self.full_clean()  # Runs clean() method
        super().save(*args, **kwargs)
        # Update restaurant's cached ratings
        self.restaurant.update_rating_cache()
    
    def delete(self, *args, **kwargs):
        restaurant = self.restaurant
        super().delete(*args, **kwargs)
        # Update restaurant's cached ratings after deletion
        restaurant.update_rating_cache()