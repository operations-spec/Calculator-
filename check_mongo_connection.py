import os
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, ConfigurationError, ServerSelectionTimeoutError

def check_mongo_connection():
    # Get MongoDB URI from environment
    mongo_uri = os.getenv('MONGODB_URI') or os.getenv('MONGO_URI')
    db_name = os.getenv('DB_NAME', 'moneda_db')
    
    if not mongo_uri:
        print("❌ Error: MONGODB_URI or MONGO_URI environment variable is not set")
        return
    
    print(f"Checking MongoDB connection to: {mongo_uri}")
    print(f"Database: {db_name}")
    
    try:
        # Use the same connection parameters as in app.py
        mongo_params = {
            'serverSelectionTimeoutMS': 5000,
            'retryWrites': True,
            'w': 'majority',
            'connectTimeoutMS': 5000,
            'socketTimeoutMS': 5000
        }
        
        # Add TLS/SSL options if using MongoDB Atlas
        if 'mongodb+srv://' in mongo_uri:
            mongo_params.update({
                'tls': True
            })
        
        # Try to connect
        client = MongoClient(mongo_uri, **mongo_params)
        
        # Test the connection
        client.admin.command('ping')
        print("✅ Successfully connected to MongoDB")
        
        # List databases
        print("\nAvailable databases:")
        for db in client.list_database_names():
            print(f"- {db}")
        
        # Check if our target database exists
        if db_name in client.list_database_names():
            db = client[db_name]
            print(f"\n✅ Database '{db_name}' exists")
            
            # Check collections
            collections = db.list_collection_names()
            print("\nCollections in the database:")
            for col in collections:
                print(f"- {col}")
            
            # Check users collection
            if 'users' in collections:
                users_count = db.users.count_documents({})
                print(f"\n✅ 'users' collection exists with {users_count} documents")
            else:
                print("\n❌ 'users' collection does not exist")
        else:
            print(f"\n❌ Database '{db_name}' does not exist")
            
    except ServerSelectionTimeoutError as e:
        print(f"❌ Could not connect to MongoDB (timeout): {str(e)}")
    except ConnectionFailure as e:
        print(f"❌ Could not connect to MongoDB: {str(e)}")
    except ConfigurationError as e:
        print(f"❌ MongoDB configuration error: {str(e)}")
    except Exception as e:
        print(f"❌ Unexpected error: {str(e)}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    check_mongo_connection()
