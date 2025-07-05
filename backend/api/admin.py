from django.contrib import admin
from .models import Restaurant, Rating


@admin.register(Restaurant)
class RestaurantAdmin(admin.ModelAdmin):
    list_display = ['name', 'address', 'average_rating', 'total_ratings', 'created_at']
    list_filter = ['created_at', 'average_rating']
    search_fields = ['name', 'address', 'place_id']
    readonly_fields = ['average_rating', 'total_ratings', 'created_at']
    
    fieldsets = (
        ('Basic Information', {
            'fields': ('place_id', 'name', 'address')
        }),
        ('Location', {
            'fields': ('latitude', 'longitude')
        }),
        ('Ratings', {
            'fields': ('average_rating', 'total_ratings'),
            'description': 'These fields are automatically calculated'
        }),
        ('Metadata', {
            'fields': ('created_at',)
        })
    )


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ['restaurant', 'rating', 'review_preview', 'created_at']
    list_filter = ['rating', 'created_at']
    search_fields = ['restaurant__name', 'review']
    raw_id_fields = ['restaurant']
    
    def review_preview(self, obj):
        return obj.review[:50] + '...' if len(obj.review) > 50 else obj.review
    review_preview.short_description = 'Review'