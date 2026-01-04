from datetime import timedelta,datetime
import datetime as d
import operator
from event import Event
from slot import Slot

class ConferenceManager():
    """
    This class contains scheduling logic. Following is the logic:
      * Read data from file, 
      * create a list of Event objects,
      * sort the list of Events,
      * find out the combination for morning session and evening sessions
    """

    morning=[]#list containing morning talks
    evening=[]#list containing evening talks
    perday=7*60 #max session in a day
    
    def __init__(self,file):
        """list of talk events as read from the input saved as Event objects
        This method takes file as a input"""
        self.talk_list=self.readInput(file)
        self.total_time=self.totaltime(self.talk_list)
        self.schedule(self.talk_list)
    
    def readInput(self,file):
        """Read the input file and storing as event object
        This method takes file as a input"""
        talks = []
        with open(file) as f:
            for line in f:
                title, minutes = line.rsplit(maxsplit=1)
                try:
                    minutes = int(minutes[:-3])
                # negative indexing raises error, so it means it's lightning
                except ValueError:
                    minutes = 5
                event=Event(line,minutes)
                talks.append(event)
        return talks

    def schedule(self,talk_list):
        """Schedule events for a list of events
        This method takes list of talks as input"""
        totaltime=self.totaltime(talk_list)
        possibledays=int(totaltime/self.perday)+1
        talk_list.sort(key=operator.attrgetter('duration'))
        m=self.combinations(talk_list,possibledays,Slot(3*60))#morning slot
        self.clear(m)#clearing scheduled talks
        evening_slot=Slot(4*60,3*60)
        e=self.combinations(talk_list,possibledays,evening_slot)#morning slot
        self.clear(e) #clearing scheduled talks
        if(self.talk_list):
            raise Exception("Unable to schedule all task for conferencing")
        self.morning=m
        self.evening=e

    def combinations(self,event_list,possibledays,slot):
        """
        This method gives a list of list of events that can be scheduled 
        for given slot
        It takes list of events to be scheduled, possible days and the slot 
        -morning or evening
        """
        list_size=len(event_list)
        e=[]
        count=0
        for i in range(list_size):
            start=i
            totaltime=0
            comb=[]
            while(start is not list_size):
                curr=start
                start+=1
                event=event_list[curr]
                if event.scheduled or not slot.isValidEvent(event,totaltime):
                    continue

                comb.append(event)
                totaltime+=event.duration
                if totaltime>=slot.max:
                    break
          
            if slot.isValidSession(totaltime):
                e.append(comb)
                for talk in comb:
                    #marking events selected as scheduled
                    talk.scheduled=True
                count+=1
                if count==possibledays:
                    break

        return e

    def totaltime(self,talk_list):
        """Total minutes in a list of talks
        This method takes a list as a input"""
        return sum([event.duration for event in talk_list])

    def clear(self,slot_list):
        """Clear already scheduled events from list of events
        This method takes list as a input"""
        for event_list in slot_list:
            for event in event_list:
                self.talk_list.remove(event)

    def print_output(self):
        """
        This returns a string of output in a required format
        """
        format="%I:%M%p"
        out=''
        for day in range(len(self.morning)):
            date = datetime(1,1,1,hour=9)
            out+="Track " + str(day+1) + ":"+"\n"
            for event in self.morning[day]:
                out+=date.strftime(format)+" "+event.name+"\n"
                date=date+d.timedelta(minutes=event.duration)

            out+=date.strftime(format)+ " Lunch"+"\n"
            date=date+d.timedelta(minutes=60)

            try:#to handle cases where morning session has extra session and no evening session
                for event in self.evening[day]:
                    out+=date.strftime(format)+" "+event.name+"\n"
                    date=date+d.timedelta(minutes=event.duration)
            except:
                pass

            #if evening event finishes before 4PM Network event at 4PM
            #else it is occured at 5PM if it evening slot finished between 4 and 5 PM
            if(date<=datetime(1,1,1,hour=16)):
                date=datetime.min+d.timedelta(hours=16)
            else:
                date=datetime.min+d.timedelta(hours=17)
            out+=date.strftime(format)+ " Network Event"+"\n"+"\n"
            
        return out


