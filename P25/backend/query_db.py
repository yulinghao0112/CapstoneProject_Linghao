#!/usr/bin/env python3
"""
Database query script to check meetings, users, and find the correct user_id for meeting 618
"""

from app import db, app
from models import User, Meeting, Material, Message, Task

def query_database():
    with app.app_context():
        print("=" * 60)
        print("DATABASE ANALYSIS REPORT")
        print("=" * 60)
        
        # 1. Check all users
        print("\n1. ALL USERS:")
        users = User.query.all()
        print(f"Total users: {len(users)}")
        for user in users:
            print(f"   - User ID: {user.id}, Email: {user.email}, Username: {user.username}")
        
        # 2. Check all meetings
        print("\n2. ALL MEETINGS:")
        meetings = Meeting.query.all()
        print(f"Total meetings: {len(meetings)}")
        for meeting in meetings:
            print(f"   - Meeting ID: {meeting.meeting_id}, User ID: {meeting.user_id}, Title: {meeting.title}")
        
        # 3. Check specifically for meeting 618
        print("\n3. MEETING 618 SEARCH:")
        meeting_618_results = Meeting.query.filter_by(meeting_id=618).all()
        if meeting_618_results:
            for meeting in meeting_618_results:
                print(f"   ✅ Found meeting 618: User ID {meeting.user_id}, Title: '{meeting.title}'")
                
                # Check materials for this meeting
                materials = Material.query.filter_by(user_id=meeting.user_id, meeting_id=618).all()
                print(f"   📄 Materials count: {len(materials)}")
                for material in materials:
                    print(f"      - File: {material.filename}, Size: {len(material.content)} chars")
                    print(f"      - Preview: {material.content[:100]}...")
                
                # Check messages for this meeting
                messages = Message.query.filter_by(user_id=meeting.user_id, meeting_id=618).all()
                print(f"   💬 Messages count: {len(messages)}")
                for msg in messages[-3:]:  # Show last 3 messages
                    print(f"      - {msg.speaker}: {msg.content[:80]}...")
                
                # Check tasks for this meeting
                tasks = Task.query.filter_by(user_id=meeting.user_id, meeting_id=618).all()
                print(f"   📋 Tasks count: {len(tasks)}")
                for task in tasks:
                    print(f"      - Task: {task.summary}, Assignee: {task.assignee}")
        else:
            print("   ❌ No meeting with ID 618 found")
        
        # 4. Check meetings with materials (meetings that have content to analyze)
        print("\n4. MEETINGS WITH MATERIALS:")
        meetings_with_materials = db.session.query(Meeting).join(Material).distinct().all()
        print(f"Total meetings with materials: {len(meetings_with_materials)}")
        for meeting in meetings_with_materials:
            material_count = Material.query.filter_by(user_id=meeting.user_id, meeting_id=meeting.meeting_id).count()
            print(f"   - Meeting {meeting.meeting_id} (User {meeting.user_id}): {material_count} materials")
        
        # 5. Find the user credentials (demo login info)
        print("\n5. DEMO LOGIN INFO:")
        demo_user = User.query.filter_by(email="11@qq.com").first()
        if demo_user:
            print(f"   ✅ Demo user found: ID {demo_user.id}, Email: {demo_user.email}")
            user_meetings = Meeting.query.filter_by(user_id=demo_user.id).all()
            print(f"   📅 Demo user's meetings: {[m.meeting_id for m in user_meetings]}")
        else:
            print("   ❌ Demo user (11@qq.com) not found")
        
        print("\n" + "=" * 60)
        print("ANALYSIS COMPLETE")
        print("=" * 60)

if __name__ == "__main__":
    query_database()