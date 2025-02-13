import requests
import random

# url = 'http://localhost:5000/device_input'  # localhost
# url = 'http://gps-server-nodejs.onrender.com/device_input'
url = 'http://129.151.193.104:5000/device_input'

device = 603

def generate_random_coordinates():
    # Generate random latitude and longitude
    latitude = random.uniform(-90, 90)
    longitude = random.uniform(-180, 180)
    
    return latitude, longitude

# Generate random GPS coordinates
latitude, longitude = generate_random_coordinates()
data = {'latitude': latitude, 'longitude': longitude, 'device': device}

response = requests.post(url, json=data)  # Use json=data instead of data=data

print(f'Status code: {response.status_code}')
print(f'Sent coordinates: Latitude = {latitude}, Longitude = {longitude}, device = {device}')
