try:
    from backend.main import app
    print("Backend imported successfully")
except Exception as e:
    import traceback
    traceback.print_exc()
